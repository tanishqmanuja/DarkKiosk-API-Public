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


async function getFees() {
    let data = [];

    let page;
    try {
        page = await request({
            secureProtocol: 'TLSv1_method',
            strictSSL: false,
            url: 'https://webkiosk.jiit.ac.in/StudentFiles/FAS/StudRegFee.jsp',
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

	page$('table').has('thead').children('tbody').children('tr').each((i, el) => {
		let entry = {};
		let firstTd = page$(el).children('td').eq(0).html();
		if (firstTd && firstTd.includes('(REG)')) {
			let repair = (string) => {
				return string.substring(0, string.indexOf('&')).trim()
			}
			entry.sem = page$(el).children('td').eq(0).children('font').html().trim().charAt(0)
			entry.total = page$(el).children('td').eq(2).children('font').children('a').html().trim()
			entry.paid = repair(page$(el).children('td').eq(4).children('font').html())
			entry.due = repair(page$(el).children('td').eq(5).children('font').html())
			data.push(entry)
		}
	});
	return { data };
}

router.get('/',async (req,res,next)=>{
    data = await getFees()
    res.status(200).json({
        fetchedAt: Date.now(),
        ...data
	})
	next(data.error?data.msg:'')
})

module.exports = router;