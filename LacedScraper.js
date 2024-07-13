const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const mysql = require('mysql');
require('dotenv').config();
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const urls = [
    'https://www.laced.com/new-in',
    'https://www.laced.com/best-sellers'
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
        INSERT INTO laced_data (product_name, product_price, pruduct_url, product_img, product_website, created_at)
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

(async () => {
    const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1800,1200'] });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    for (const url of urls) {
        console.log(`Navigating to: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Accept cookies if it comes up
        try {
            const cookieButton = await page.$("div[data-testid='SimpleCookieForm'] button[class='css-1if36b4']");
            if (cookieButton) {
                await cookieButton.click();
                console.log("Accepted cookies");
            }
        } catch (error) {
            console.log("Error handling cookies on:", url, error);
        }

        let previousHeight;
        let products = [];

        while (true) {
            const newProducts = await page.evaluate(() => {
                const productsArray = [];
                const productElements = document.querySelectorAll("li[class='product-grid__item']");

                productElements.forEach((productElement) => {
                    const productBrandElement = productElement.querySelector("span:first-of-type");
                    const productBrand = productBrandElement ? productBrandElement.innerText.trim() : "No Brand";

                    const productNameElement = productElement.querySelector("span:nth-of-type(2)");
                    const productName = productNameElement ? productNameElement.innerText.trim() : "No Name";

                    const productPriceElement = productElement.querySelector("span:last-of-type");
                    const productPrice = productPriceElement ? productPriceElement.innerText.trim() : "No Price";

                    const productLinkElement = productElement.querySelector('a');
                    const productLink = productLinkElement ? productLinkElement.href : "No Link";

                    const productImageElement = productElement.querySelector('.product-picture img');
                    const productImage = productImageElement ? productImageElement.getAttribute('data-src') : "No Image";

                    productsArray.push({
                        brand: productBrand,
                        name: productName,
                        price: productPrice,
                        image: productImage,
                        link: productLink,
                        website: "Laced.com"
                    });
                });

                window.scrollTo(0, document.body.scrollHeight);
                return productsArray;
            });

            products = products.concat(newProducts);

            const currentHeight = await page.evaluate('document.body.scrollHeight');
            if (previousHeight && previousHeight === currentHeight) break;
            previousHeight = currentHeight;

            await new Promise(resolve => setTimeout(resolve, 8000));
        }

        // Log each product with its details
        products.forEach((product) => {
            console.log('Product:', product);
        });

        // Insert products into the database
        insertProductsIntoDatabase(products);
    }

    await browser.close();
})();
