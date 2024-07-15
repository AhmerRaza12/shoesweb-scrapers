const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const mysql = require('mysql');
require('dotenv').config();

puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const urls = [
    'https://www.stadiumgoods.com/en-us/shopping/man',
    'https://www.stadiumgoods.com/en-us/shopping/woman',
    'https://www.stadiumgoods.com/en-us/shopping/kid',
    'https://www.stadiumgoods.com/en-us/shopping/streetwear',
    'https://www.stadiumgoods.com/en-us/sets/new-releases',
    'https://www.stadiumgoods.com/en-us/shopping?categories=195318',
    'https://www.stadiumgoods.com/en-us/shopping/asics',
    'https://www.stadiumgoods.com/en-us/shopping/nike-shoes',
    'https://www.stadiumgoods.com/en-us/shopping/adidas-shoes',
    'https://www.stadiumgoods.com/en-us/shopping/jordan-shoes',
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
        INSERT INTO stadiumgoods_data (product_name, product_price, pruduct_url, product_img, product_website)
        VALUES (?, ?, ?, ?, ?)
    `;

    products.forEach(product => {
        connection.query(query, [
            product.name,
            product.price,
            product.link,
            product.image,
            product.website,
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

const scrollToEndOfPage = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
};

const scrapeImages = async (page) => {
    await scrollToEndOfPage(page);

    const images = await page.evaluate(() => {
        const imageElements = document.querySelectorAll("article[data-test='productCard'] img");
        const imageList = [];
        imageElements.forEach(imageElement => {
            const srcset = imageElement.getAttribute('srcset');
            const imageUrl = srcset ? srcset.split(', ')[1].split(' ')[0] : imageElement.src;
            imageList.push(imageUrl);
        });

        return imageList;
    });

    return images;
};

(async () => {
    const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1800,1200'] });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    for (const url of urls) {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        let currentPage = 1;
        const maxPages = 5;

        while (currentPage <= maxPages) {
            await page.waitForSelector('div.eh9rc8u2.css-1bjpnpj.egx6e7n0'); 

            const products = await page.evaluate(() => {
                const productsArray = [];
                const productElements = document.querySelectorAll('div.eh9rc8u2.css-1bjpnpj.egx6e7n0');

                productElements.forEach((productElement) => {
                    const productBrandElement = productElement.querySelector("p[data-test='productThumbnail-brandName']");
                    const productBrand = productBrandElement ? productBrandElement.innerText.trim() : "No Brand";

                    const productNameElement = productElement.querySelector('a');
                    const productName = productNameElement ? productNameElement.getAttribute('aria-label') : "No Name";

                    const productPriceElement = productElement.querySelector("span[aria-label='normal-price']");
                    const productPrice = productPriceElement ? productPriceElement.innerText.trim() : "No Price";

                    const productImageElement = productElement.querySelector('img[data-test="productThumbnail-primaryImage"]');
                    let productImage = "No Image";
                    if (productImageElement) {
                        const srcset = productImageElement.getAttribute('srcset');
                        if (srcset) {
                            const imageUrl = srcset.split(', ')[0].split(' ')[0]; 
                            productImage = imageUrl;
                        }
                    }

                    const productLinkElement = productElement.querySelector('a');
                    const productLink = productLinkElement ? productLinkElement.href : "No Link";

                    productsArray.push({
                        brand: productBrand,
                        name: productName,
                        price: productPrice,
                        image: productImage,
                        link: productLink,
                        website: "Stadiumgoods.com",
                    });
                });

                return productsArray;
            });

            const images = await scrapeImages(page);
            for (let i = 0; i < products.length; i++) {
                if (products[i].image === "No Image" && images[i]) {
                    products[i].image = images[i];
                }
            }

            products.forEach((product) => {
                console.log('Product:', product);
            });

            insertProductsIntoDatabase(products);

            await page.waitForSelector('button[aria-label="Next Page"]');
            const nextPageButton = await page.$('button[aria-label="Next Page"]:not([disabled])');
            if (!nextPageButton) {
                console.log('No more pages to scrape.');
                break;
            }
            await Promise.all([
                nextPageButton.click(),
                page.waitForNavigation({ waitUntil: "domcontentloaded" })
            ]);

            currentPage++;
        }
    }

    await browser.close();
})();
