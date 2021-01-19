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

async function getAttendance(detailed = false,semcode,coursecode) {
	let data = [];
	let urls = [];
	let page;

	let query = semcode ? `?x=&exam=${semcode}`:''
    try {
		page = await request({
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/StudentFiles/Academic/StudentAttendanceList.jsp'+query,
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

	let currentSem = page$('table>tbody').children('tr').eq(1).children().eq(2).text()
	currentSem = parseInt(currentSem.substring(currentSem.lastIndexOf(':')+1)).toString()
	let options = page$('form>table>tbody').children('tr').eq(1).children('td').eq(0).children('select').children('option')
	let currentSemCode = options.eq(options.length-currentSem).text();
	let semCode = options.filter((i,el)=>{
		return page$(el).attr('selected')
	}).eq(0).text()
	page$('#table-1>tbody').children('tr').each((i, el) => {
		let repair = (el) => {
			if (el) return el.html();
			else return undefined;
		};
		let course = page$(el).children('td').eq(1).html();
		let ccode = course.substring(course.lastIndexOf('-') + 1, course.length).trim()
		let attendance = {
			total: repair(page$(el).children('td').eq(2).children('a')),
			lec: repair(page$(el).children('td').eq(3).children('a').children('font')),
			tut: repair(page$(el).children('td').eq(4).children('a')),
			prac: repair(page$(el).children('td').eq(5).children('a'))
		};
		
		if(!coursecode || coursecode==ccode){
			data.push({
				course: {
					name: course.substring(0, course.lastIndexOf('-')).trim(),
					code: ccode
				},
				attendance: cleanObject(attendance)
			});
		}

		if(!detailed) return;
		if(!coursecode || coursecode==ccode){
			if (attendance.total && attendance.prac) {
				urls.push([
					page$(el).children('td').eq(2).children('a').attr('href'),
					page$(el).children('td').eq(5).children('a').attr('href')
				]);
			} else if (attendance.total) {
				urls.push([page$(el).children('td').eq(2).children('a').attr('href')]);
			} else if (attendance.prac) {
				urls.push([page$(el).children('td').eq(5).children('a').attr('href')]);
			} else if (attendance.lec) {
				urls.push([page$(el).children('td').eq(3).children('a').attr('href')]);
			} else if (attendance.tut) {
				urls.push([page$(el).children('td').eq(4).children('a').attr('href')]);
			} else {
				urls.push([])
			}
		} else { urls.push([]) }
	});
	for (let i = 0; i < urls.length; i++) {
		let details = [];
		if (!urls[i].length) {
			continue;
		}
		let index = coursecode ? 0 : i;
		data[index].details = [];
		for(let u = 0; u < urls[i].length ; u++){
			let detailsPage;
			try {
				detailsPage = await request({
					secureProtocol: 'TLSv1_method',
					strictSSL: false,
					url: 'https://webkiosk.jiit.ac.in/StudentFiles/Academic/'+urls[i][u],
					headers: headers,
					resolveWithFullResponse: true
				});
			} catch (error) {
				return {
					error: true,
					msg: "Request to Webkiosk failed"
				}
			}
	
			let detailsPage$ = cheerio.load(detailsPage.body);
			detailsPage$('#table-1>tbody').children('tr').each((c, el) => {
				let detail = {
					date: detailsPage$(el).children('td').eq(1).html(),
					teacher: detailsPage$(el).children('td').eq(2).html(),
					status: detailsPage$(el).children('td').eq(3).children('font').children('b').html(),
					class: detailsPage$(el).children('td').eq(4).html(),
					type: detailsPage$(el).children('td').eq(5).children('b').children('font').html()
				};
				if(!detail.type) detail.type = "Practical";
				details.push(detail);
			});
			(data[index].details).push(...details.reverse());
		}
	}
	return {currentSem,currentSemCode,semCode,data};
}


router.get('/',async (req,res,next)=>{
	let semcode = req.query.semcode
	let coursecode = req.query.coursecode
    data = await getAttendance(false,semcode,coursecode)
    res.status(200).json({
		fetchedAt: Date.now(),
		...data
	})
	next(data.error?data.msg:'')
})

router.get('/detailed',async (req,res,next)=>{
	let semcode = req.query.semcode
	let coursecode = req.query.coursecode
    data = await getAttendance(true,semcode,coursecode)
    res.status(200).json({
		fetchedAt: Date.now(),
		...data
	})
	next(data.error?data.msg:'')
})


module.exports = router;