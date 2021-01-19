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

async function getPoints() {
	let data = [];
	let page
	try {
		page = await request({
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/StudentFiles/Exam/StudCGPAReport.jsp',
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

	page$('#table-1>tbody').children('tr').each((i, el) => {
		data.push({
			sem: (i + 1).toString(),
			credit: page$(el).children('td').eq(2).html(),
			sg: page$(el).children('td').eq(6).html(),
			cg: page$(el).children('td').eq(7).html()
		});
	});
	return {data};
}

router.get('/',async (req,res,next)=>{
    data = await getPoints()
    res.status(200).json({
		fetchedAt: Date.now(),
		...data
	})
	next(data.error?data.msg:'')
})

module.exports = router;