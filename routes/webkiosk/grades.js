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

async function getGrades() {
	let page;
	try {
		page = await request({
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/StudentFiles/Exam/StudentEventGradesView.jsp',
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

	let sems = [];
	page$("select[name='exam']").find('option').each((i, el) => {
		sems.push(el.children[0].data);
	});

	let data = new Array(sems.length-1)

	for (let sem = 1; sem <= sems.length;sem++) {
		let gradePage
		try {
			gradePage = await request({
				secureProtocol: 'TLSv1_method',
				strictSSL: false,
				url: 'https://webkiosk.jiit.ac.in/StudentFiles/Exam/StudentEventGradesView.jsp?x=&exam=' + sems[sem],
				headers: headers,
				resolveWithFullResponse: true
			});
		} catch (error) {
			return {
				error: true,
				msg: "Request to Webkiosk failed"
			}
		}
		let gradePage$ = cheerio.load(gradePage.body);
		let found = gradePage$('#table-1>tbody').children('tr')
		if(found.length){
			found.each(function (i, el) {
				let course = gradePage$(el)
					.children('td')
					.eq(1)
					.children('font')
					.html()
					.trim()
					.replace('  ', ' ')
					.replace(' -', '-')
					.replace('amp;', '');
				let grade = gradePage$(el).children('td').eq(3).children('font').html().trim();
				grade = grade.substring(0, grade.indexOf('<'));
				if (!data[sem - 1]) data.fill([],sem-1,sem);
				data[sem - 1][i] = {
					course: {
						name: course.substring(0, course.lastIndexOf('(')).trim(),
						code: course.substring(course.lastIndexOf('(') + 1, course.length - 1).trim()
					},
					grade: grade
				};
			});
		}
	}
	data = data.filter(Boolean).reverse().map((gradesheet,index)=>{
		return {
			sem: index+1,
			gradesheet
		}
	})
	return {data};
}


router.get('/',async (req,res,next)=>{
    data = await getGrades()
    res.status(200).json({
		fetchedAt: Date.now(),
		...data
	})
	next(data.error?data.msg:'')
})

module.exports = router;