const mysql = require('mysql');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    password: process.env.DB_PASSWORD
};

(async () => {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
    
    puppeteer.use(StealthPlugin());
    puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

    const urls = [
        "https://stockx.com/sneakers",
        "https://stockx.com/streetwear",
        "https://stockx.com/collectibles",
        "https://stockx.com/handbags",
        "https://stockx.com/watches",
    ];

    const { connect } = await import('puppeteer-real-browser');

    const { page, browser } = await connect({ headless: false, turnstile: true });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");

    async function insertProductsIntoDatabase(products) {
        const connection = mysql.createConnection(dbConfig);

        connection.connect(err => {
            if (err) {
                console.error('Error connecting to database:', err.stack);
                return;
            }
            console.log('Connected to database as id', connection.threadId);
        });

        const query = `
            INSERT INTO stockx_data (product_name, product_price, pruduct_url, product_img, product_website, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;

        products.forEach(product => {
            connection.query(query, [
                product.name,
                product.price,
                product.link,
                product.image,
                product.website
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

    for (const url of urls) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('div[data-testid="productTile"]');

        const products = await page.evaluate(() => {
            const productContainers = Array.from(
                document.querySelectorAll('div[data-testid="productTile"]')
            );

            const productsArray = productContainers.map(container => {
                const nameElement = container.querySelector('p[data-testid="product-tile-title"]');
                const priceElement = container.querySelector('p[data-testid="product-tile-lowest-ask-amount"]');
                const linkElement = container.querySelector('a[data-testid="productTile-ProductSwitcherLink"]');
                const imageElement = container.querySelector('img[alt]');

                return {
                    name: nameElement ? nameElement.textContent.trim() : null,
                    price: priceElement ? priceElement.textContent.trim() : null,
                    link: linkElement ? linkElement.href : null,
                    image: imageElement ? imageElement.src : null,
                    website: "Stockx.com"
                };
            });

            return productsArray;
        });

      
        await insertProductsIntoDatabase(products);


        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await browser.close();
})();
