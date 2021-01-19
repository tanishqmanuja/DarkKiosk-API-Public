const express = require('express');
const morgan = require('morgan')
const cors = require('cors')({
	origin: true
});

const app = express();
app.use(cors);
app.use(morgan('tiny'))
app.get('/',(req,res)=>{
	res.status(200).send("Welcome to Darkkiosk API")
	return;
})

//APIs
const webkiosk = require('./routes/webkiosk/api')
app.use('/webkiosk',webkiosk) 


let port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`DarkKiosk APIs active at ${process.env.PORT?'':'http://localhost:'}${port}`);
});