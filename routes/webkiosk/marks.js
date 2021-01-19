const express = require('express');
const cheerio = require('cheerio');
const request = require('request-promise');
const { cleanObject } = require('./utils');

let headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36',
	'Content-Type': 'application/x-www-form-urlencoded'
};

const router = express.Router();

router.use((req,res,next)=>{
	headers = res.locals.wkheaders;
	next();
})

async function getMarksForSem(semcode){
	let data = [];
	if(!semcode){
		return {
			error: true,
			msg: "Invalid Semcode"
		}
	}
	let query = `?x=&exam=${semcode}`
	let markPage;
	try {
		markPage = await request({
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/StudentFiles/Exam/StudentEventMarksView.jsp' + query,
			headers: headers,
			resolveWithFullResponse: true
		});	
	} catch (error) {
		return {
			error: true,
			msg: "Request to Webkiosk failed"
		}
	}

	let markPage$ = cheerio.load(markPage.body);

	if(markPage$('body').text().includes('Session Timeout Please')){
		return {
			error: true,
			msg: "Session Timeout"
		}
	}

	let thead = [];
	markPage$('#table-1>thead').children('tr').children('td').each((i, el) => {
		let str = markPage$(el).children('font').children('b').html();
		str = str ? str.replace('<br>', '') : null;
		thead.push(str);
	});
	markPage$('#table-1>tbody').children('tr').each((i, el) => {
		let tr = [];
		markPage$(el).children('td').each((i, el) => {
			tr.push(markPage$(el).html());
		});
		let repair = (str) => {
			if (str) str = str.replace(/\s/g, '');
			if (str && str.length > 0) return str;
			else return undefined;
		};
		let course = tr[1].trim().replace('  ', ' ').replace(' -', '-').replace('amp;', '');
		let marks = {
			t1: repair(
				tr[
					thead.findIndex((str,i) => {
						if (str) return str.charAt(0) == 'T' && str.substring(0, str.indexOf('(')).includes('1') && !!tr[i].replace(/\s/g,'');
						else return false;
					})
				]
			),
			t2: repair(
				tr[
					thead.findIndex((str,i) => {
						if (str) return str.charAt(0) == 'T' && str.substring(0, str.indexOf('(')).includes('2') && !!tr[i].replace(/\s/g,'');
						else return false;
					})
				]
			),
			t3: repair(
				tr[
					thead.findIndex((str) => {
						if (str) return str.includes('(35.0)');
						else return false;
					})
				]
			),
			labmid: repair(tr[thead.indexOf('LAB#MIDVIVA(20.0)')]),
			labend: repair(tr[thead.indexOf('LAB#ENDVIVA(20.0)')]),
			midva: repair(tr[thead.indexOf('MID VA(30.0)')])
		};
		if (!data[i]) data.push([]);
		data[i] = {
			course: {
				name: course.substring(0, course.lastIndexOf('-')).trim(),
				code: course.substring(course.lastIndexOf('-') + 1, course.length).trim()
			},
			marks: cleanObject(marks)
		};
	});
	data = { semCode:semcode, marksheet:data }
	return { data:[data] };
}

router.get('/',async (req,res,next)=>{
	let semcode = req.query.semcode
    data = await getMarksForSem(semcode)
    res.status(200).json({
		fetchedAt: Date.now(),
		...data
	})
	next(data.error?data.msg:'')
})

module.exports = router;