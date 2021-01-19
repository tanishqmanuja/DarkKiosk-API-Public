const express = require('express');
const cheerio = require('cheerio');
const request = require('request-promise');

let headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36',
	'Content-Type': 'application/x-www-form-urlencoded'
};

const router = express.Router();

router.use((req,res,next)=>{
	headers = res.locals.wkheaders;
	next();
})

async function getSubjects(semcode) {
    let data = [];
	let page;
	let query = semcode ? `?x=&exam=${semcode}`:''
    try {
        page = await request({
            secureProtocol: 'TLSv1_method',
            strictSSL: false,
            url: 'https://webkiosk.jiit.ac.in/StudentFiles/Academic/StudSubjectTaken.jsp'+query,
            headers: headers,
            resolveWithFullResponse: true
        });
    } catch (error) {
        return {
			error: true,
			msg: "Request to Webkiosk failed"
		}
    }
	
	let page$ = cheerio.load(page.body);
	
	if(page$('body').text().includes('Session Timeout Please')){
		return {
			error: true,
			msg: "Session Timeout"
		}
	}
    
    let currentSem = page$('form>table>tbody').children('tr').eq(0).children('td').eq(0).text()
    currentSem = currentSem.substring(currentSem.lastIndexOf('Sem:')+4,currentSem.lastIndexOf('\n'))
	currentSem = parseInt(currentSem).toString()
	let currentSemCode = page$('form>table>tbody').children('tr').eq(1).children('td').eq(0).children('select').children('option').eq(parseInt(currentSem)-1).text()
	let semCode = page$('form>table>tbody').children('tr').eq(1).children('td').eq(0).children('select').children('option').filter((i,el)=>{
		return page$(el).attr('selected')
	}).last().text()
	page$('table').eq(2).children('tbody').children('tr').each((i, el) => {
		let course = page$(el)
			.children('td')
			.eq(1)
			.html()
			.trim()
			.replace('  ', ' ')
			.replace(' -', '-')
			.replace('amp;', '');
		let credit = page$(el)
			.children('td')
			.eq(2)
			.html()
			.trim();
		data.push({
			name: course.substring(0, course.lastIndexOf('(')).trim(),
			code: course.substring(course.lastIndexOf('(') + 1, course.length - 1).trim(),
			credit: credit
        });
    });
    let totalCredits = data[data.length-1] && data[data.length-1].code
    totalCredits = totalCredits.substring(totalCredits.lastIndexOf('>')+1,totalCredits.lastIndexOf('<'))
    totalCredits = parseInt(totalCredits).toString()
    data = data.slice(1,-1)
	return { currentSem,currentSemCode,data: [{
		semCode,
		totalCredits,
		subjectList: data
		}] 
	};
}

router.get('/',async (req,res,next)=>{
	let semcode = req.query.semcode
    data = await getSubjects(semcode)
    res.status(200).json({
		fetchedAt: Date.now(),
		...data
	})
	next(data.error?data.msg:'')
})

module.exports = router;