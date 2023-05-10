require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');

// Подключение к базе данных
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error(error));

// Определение схемы и модели для коллекции cad_videos
const cadVideoSchema = new mongoose.Schema({
    videoUrl: String,
    fileName: String
});

const CadVideo = mongoose.model('CadVideo', cadVideoSchema);

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--start-maximized'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to the login page
        await page.goto('https://openedu.ru/my/', { waitUntil: 'networkidle2' });

        // Wait for the login form to load and enter the credentials
        await page.waitForSelector('input[name="username"]', { visible: true });
        await page.waitForSelector('input[name="password"]', { visible: true });
        await page.type('input[name="username"]', process.env.USERNAME_VAL);
        await page.type('input[name="password"]', process.env.PASSWORD_VAL);

        // Click the login button and wait for the page to load
        await page.waitForSelector('.btn-submit', { visible: true });
        await page.click('.btn-submit');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Navigate to the desired page
        await page.goto('https://apps.openedu.ru/learning/course/course-v1:misis+IKG+spring_2023/home', { waitUntil: 'networkidle2' });
        await page.waitForSelector('.course-outline-tab', { visible: true });

        await page.click('.course-outline-tab .btn');

        // Execute the code after the page has loaded
        const links = await page.evaluate(() => {
            return [...document.querySelectorAll('div.col.col-12.col-md-8 .list-unstyled a')].map(item => item.href);
        });

        for (const link of links) {
            const newPage = await browser.newPage();
            await newPage.setViewport({ width: 1920, height: 1080 });
            await newPage.goto(link, { waitUntil: 'networkidle2' });
            await newPage.waitForSelector('[aria-label="breadcrumb"]', { visible: true });
            await newPage.waitForSelector('.sequence', { visible: true });
            await newPage.waitForSelector('#unit-iframe', { visible: true });

            const breadcrumb = await newPage.evaluate(() => {
                return [...document.querySelectorAll('[aria-label="breadcrumb"] a')].map(item => item.text);
            });

            const fileName = `${breadcrumb.join('/')}.mp4`;

            const iframe = await newPage.$('#unit-iframe');

            if (iframe) {
                const frame = await iframe.contentFrame();
                const video = await frame.$('video');

                if (video) {
                    // Find the video element and get the source URL
                    const source = await video.$('source[data-size="1920"]');
                    const videoUrl = await source.evaluate(el => el.getAttribute('src'));
                    const cadVideo = new CadVideo({
                        videoUrl,
                        fileName
                    });
                    await cadVideo.save();
                }
            }

            await newPage.close();
        }


        mongoose.connection.close();
        // Close the browser
        await browser.close();


    } catch (error) {
        console.error(error);
        process.exit(1); // Exit the process with an error code
    }
})();