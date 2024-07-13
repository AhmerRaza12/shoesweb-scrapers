const mysql = require('mysql');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD
};


const insertProductsIntoDatabase = (products) => {
    const connection = mysql.createConnection(dbConfig);
    connection.connect();

    const query = `
        INSERT INTO footlocker_data (product_name, product_price, pruduct_url, product_img, product_website, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    products.forEach(product => {
        connection.query(query, [
            product.name,
            product.price,
            product.link,
            product.image,
            product.website,
            new Date()
        ], (error, results, fields) => {
            if (error) {
                console.error('Error inserting data:', error);
            } else {
                console.log('Data inserted successfully:', results);
            }
        });
    });

    connection.end();
}


async function moveMouse(page, x, y) {
    await page.mouse.move(x, y, { steps: 10 });
}


async function humanScroll(page, maxScrolls) {
    for (let i = 0; i < maxScrolls; i++) {
        const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        const scrollPosition = await page.evaluate(() => window.scrollY + window.innerHeight);

        if (scrollPosition < scrollHeight) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await moveMouse(page, Math.floor(Math.random() * 800), Math.floor(Math.random() * 600));
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 2000));
        } else {
            break;
        }
    }
}


async function scrape() {
    const { connect } = await import('puppeteer-real-browser');
    const { page, browser } = await connect({ headless: false, turnstile: true });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");


    await page.setViewport({
        width: Math.floor(Math.random() * (1920 - 1366 + 1)) + 1366,
        height: Math.floor(Math.random() * (1080 - 768 + 1)) + 768,
    });

    const urls = [
        "https://www.footlocker.com/en/category/mens/shoes.html",
        "https://www.footlocker.com/en/category/clothing/mens.html",
        "https://www.footlocker.com/en/category/womens/shoes.html",
        "https://www.footlocker.com/en/category/womens/clothing.html",
        "https://www.footlocker.com/en/category/kids/shoes.html",
        "https://www.footlocker.com/en/category/kids/clothing.html",
        "https://www.footlocker.com/category/new-arrivals.html",
    ];

    for (const url of urls) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000));

        await page.waitForSelector('div.ProductCard');

        await humanScroll(page, 5); 

        const data = await page.evaluate(() => {
            const productContainers = Array.from(document.querySelectorAll('div.ProductCard'));

            const products = productContainers.map(container => {
                const nameElement = container.querySelector('span.ProductName-primary');
                const priceElement = container.querySelector('span.ProductPrice-final') || container.querySelector('span.ProductPrice');
                const linkElement = container.querySelector('a.ProductCard-link');
                const imageElement = container.querySelector('img.ProductCard-image--primary');

                return {
                    name: nameElement ? nameElement.textContent : null,
                    price: priceElement ? priceElement.textContent : null,
                    link: linkElement ? linkElement.href : null,
                    image: imageElement ? imageElement.src : null,
                    website: "Footlocker.com"
                };
            });

            return products;
        });

        console.log(data);
    }

    await browser.close();
}

data = scrape();
insertProductsIntoDatabase(data);
