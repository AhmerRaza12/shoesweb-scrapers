const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const mysql = require('mysql');
require('dotenv').config();


puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const urls = [
    'https://www.levelshoes.com/men/shoes.html',
    'https://www.levelshoes.com/men/accessories.html',
    'https://www.levelshoes.com/men/new-in.html',
    'https://www.levelshoes.com/women/shoes.html',
    'https://www.levelshoes.com/women/accessories.html',
    'https://www.levelshoes.com/women/new-in.html',
    'https://www.levelshoes.com/kids/new-in/view-all.html',
    'https://www.levelshoes.com/men/investment-pieces.html'
];

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
        INSERT INTO levelshoes_data (product_name, product_price, pruduct_url, product_img, product_website, created_at)
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
};

async function autoScroll(page) {
    const bottomRefSelector = 'div[data-testid="scroll-bottom-ref"]';
    let scrollCount = 0;

    while (scrollCount < 5) {
        await page.evaluate((bottomRefSelector) => {
            const bottomRef = document.querySelector(bottomRefSelector);
            if (bottomRef) {
                bottomRef.scrollIntoView();
            } else {
                window.scrollTo(0, document.documentElement.scrollHeight - 500);
            }
        }, bottomRefSelector);

        await new Promise(resolve => setTimeout(resolve, 10000));

        const newHeight = await page.evaluate('document.documentElement.scrollHeight');
        const bodyScrollTop = await page.evaluate('document.documentElement.scrollTop');

        if (bodyScrollTop === newHeight) {
            break;
        }

        scrollCount++;
    }
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    for (const url of urls) {
        await page.goto(url, { waitUntil: "domcontentloaded" });

        await autoScroll(page);

        const products = await page.evaluate(() => {
            const productsArray = [];
            const productElements = document.querySelectorAll('div.product-card');

            productElements.forEach((productElement) => {
                const productBrandElement = productElement.querySelector('h2.text-sm.font-bold.uppercase');
                const productBrand = productBrandElement ? productBrandElement.innerText.trim() : "No Brand";

                const productNameElement = productElement.querySelector('p.mt-1 a');
                const productName = productNameElement ? productNameElement.innerText.trim() : "No Name";

                const productPriceElement = productElement.querySelector('.mt-1.flex .me-2 span');
                const productPrice = productPriceElement ? productPriceElement.innerText.trim() : "No Price";

                const productLinkElement = productElement.querySelector('p.mt-1 a');
                const productLink = productLinkElement ? productLinkElement.href : "No Link";

                const productImageElement = productElement.querySelector('div.product-card-media-slider img');
                const productImage = productImageElement ? productImageElement.src : "No Image";

                productsArray.push({
                    brand: productBrand,
                    name: productName,
                    price: productPrice,
                    link: productLink,
                    image: productImage,
                    website: "LevelShoes.com"
                });
            });

            return productsArray;
        });

        products.forEach((product) => {
            console.log(product);
        });

        insertProductsIntoDatabase(products);
    }

    await browser.close();
})();
