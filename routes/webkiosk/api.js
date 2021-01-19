const express = require('express');
const cheerio = require('cheerio');
const request = require('request-promise');


const api = express.Router();

let headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36',
	'Content-Type': 'application/x-www-form-urlencoded'
};
let loginStatus = false;
let credentials = {
	enroll: null,
	pass: null,
	dob: null,
}
let loggedCredentials = {
	enroll: null,
	pass: null,
	dob: null,
}

async function auth(req, res, next) {
    if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {
        return res.status(401).json({
			error: true,
			msg: 'Missing Authorization Header'
		});
    }
    let enroll,pass,dob;
	try{
        let base64Credentials =  req.headers.authorization.split(' ')[1];
        let creds = JSON.parse(Buffer.from(base64Credentials, 'base64').toString('ascii'));
        enroll = creds.enroll
        pass = creds.pass
        dob = creds.dob
	}catch(err){
        return res.status(401).json({
			error: true, 
			msg: 'Invalid Authorization Header'
		});
    }


	if (!(enroll && pass && dob)) {
		return res.status(401).json({
			error: true,
			msg: 'Invalid Authorization Header'
		});
	} else if (loggedCredentials.enroll == enroll && loggedCredentials.pass == pass && loggedCredentials.dob == dob && loginStatus && headers.Cookie) {
		res.locals.wkheaders = headers;
		next();
		return;
	} else {
		credentials.enroll = enroll;
		credentials.pass = pass;
		credentials.dob = dob;
		loginRes = await login();
		if (loginRes.loginStatus) {
			loggedCredentials = credentials;
			res.locals.wkheaders = headers;
			next();
			return;
		} else {
			res.status(400).json(loginRes)
			await logout();
			return;
		}
	}
}

async function login() {
	let webkiosk;
	try {
		webkiosk = await request({
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in',
			headers: headers,
			resolveWithFullResponse: true
		});
	} catch (error) {
		loginStatus = false;
		return {
			loginStatus,
			error: true,
			msg: "Request to Webkiosk failed"
		}
	}
	let webkiosk$ = cheerio.load(webkiosk.body);
	let captcha = webkiosk$('font[face="casteller"]').html();
	headers.Cookie = webkiosk.headers['set-cookie'];
	let form;
	try {
		form = await request({
			method: 'POST',
			simple: false,
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/CommonFiles/UseValid.jsp',
			form: {
				reqfrom: 'jsp',
				x:'',
				txtInst: 'Institute',
				InstCode: 'JIIT',
				txtuType: 'Member Type',
				UserType101117: 'S',
				txtCode: 'Enrollment No',
				MemberCode: credentials.enroll,
				DOB: 'DOB',
				DATE1: credentials.dob,
				txtPin: 'Password/Pin',
				Password101117: credentials.pass,
				txtCode: 'Enter Captcha     ',
				txtcap: captcha,
				BTNSubmit: 'Submit'
			},
			headers: headers,
			resolveWithFullResponse: true
		});
	} catch (error) {
		loginStatus = false;
		return {
			loginStatus,
			error: true,
			msg: "Request to Webkiosk failed(POST)"+ " " + error
		}
	}
	//console.log(form)
	let login;
	try {
		login = await request({
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/StudentFiles/StudentPage.jsp',
			headers: headers,
			resolveWithFullResponse: true
		});
	} catch (error) {
		loginStatus = false;
		return {
			loginStatus,
			error: true,
			msg: "Request to Webkiosk failed"
		}
	}

	if (login.body.includes('Invalid Password') || form.rawHeaders[5].split('=')[1]) {
		loginStatus = false;
		return {
			loginStatus,
			error: true,
            msg: "Please provide valid login details"
        };
	} else {
        if (login.body.includes('FrameLeftStudent')) {
            loginStatus = true;
			return {
				loginStatus,
				error: false,
                msg: `${credentials.enroll} logged in successfully`
            }
		} else {
            loginStatus = false;
			return {
				loginStatus,
				error: true,
                msg: "Unknown login error occured on webkiosk"
            }
		}
	}
}

async function logout() {
	try {
		await request({
			method: 'POST',
			simple: false,
			secureProtocol: 'TLSv1_method',
			strictSSL: false,
			url: 'https://webkiosk.jiit.ac.in/CommonFiles/SignOut.jsp',
			headers: headers,
			resolveWithFullResponse: true
		});
	} catch (error) {
		return {
			error: true,
			msg: "Request to Webkiosk failed"
		}
	}
    loginStatus = false;
    let enroll = loggedCredentials.enroll || 'Nobody';
    credentials = {
        enroll: null,
        pass: null,
        dob: null,
	}
	loggedCredentials = credentials;
    return {
		error: false,
        msg: `${enroll} logged out successfully`
    }
}

api.get('/',(req,res)=>{
	return res.status(200).send('Welcome to Webkiosk API')
})

api.get('/logout',async (req,res) => {
	let logoutRes = await logout()
	return res.status(200).json(logoutRes)
})

api.use(auth)

api.get('/login',(req,res)=>{
	if(loginStatus){
		return res.status(200).json({
			loginStatus,
			error: false,
			msg: `${credentials.enroll} logged in successfully`
		})
	}
    else {
		return res.status(400).json({
			loginStatus,
			error: true,
			msg: "Something went Wrong"
		})
	}
})

const attendanceRouter = require('./attendance')
api.use('/attendance',attendanceRouter)

const feesRouter = require('./fees')
api.use('/fees',feesRouter)

const marksRouter = require('./marks')
api.use('/marks',marksRouter)

const gradesRouter = require('./grades')
api.use('/grades',gradesRouter)

const pointsRouter = require('./points')
api.use('/points',pointsRouter)

const subjectsRouter = require('./subjects')
api.use('/subjects',subjectsRouter)

api.use((error,req,res,next)=>{
	if(error=='Session Timeout'){
		logout()
	}
})

module.exports = api;