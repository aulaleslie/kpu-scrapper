const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Base folder for storing images
const bimaFolder = './bima-bupati';

// Ensure output directories exist
function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Function to check if a folder contains images
function folderHasImages(folderPath) {
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        return files.some(file => /\.(jpg|jpeg|png)$/i.test(file)); // Check for image files
    }
    return false;
}

// Function to download images
async function downloadImage(url, savePath) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(savePath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(`Image downloaded: ${savePath}`);
    } catch (error) {
        console.error(`Failed to download image ${url}:`, error.message);
    }
}

// Function to fetch images using Puppeteer
async function fetchImages(kecamatan, kelurahan, tps, kodeKecamatan, kodeKelurahan, kodeTps) {
    const url = `https://pilkada2024.kpu.go.id/pilwalkot/nusa-tenggara-barat/bima/${kodeKecamatan}/${kodeKelurahan}/${kodeTps}`;
    console.log(`Fetching images from: ${url}`);

    // Folder structure for TPS
    const tpsFolder = path.join(bimaFolder, kecamatan, kelurahan, tps);

    // Check if folder already exists and contains images
    if (folderHasImages(tpsFolder)) {
        console.log(`Skipping TPS ${kodeTps} - Images already exist in folder.`);
        return;
    }

    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Path to your Chrome installation
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Extract image URLs
        const images = await page.evaluate(() => {
            return Array.from(
                document.querySelectorAll('.card-body .row .col-md-4 a img')
            ).map(img => img.src);
        });

        if (images.length === 0) {
            console.log(`No images found for TPS ${kodeTps}`);
            return;
        }

        // Create folder structure if it doesn't exist
        ensureDirectory(tpsFolder);

        for (let i = 0; i < images.length; i++) {
            const imageUrl = images[i];
            const savePath = path.join(tpsFolder, `image_${i + 1}.jpg`);
            await downloadImage(imageUrl, savePath);
        }
    } catch (error) {
        console.error(`Failed to fetch images for TPS ${kodeTps}:`, error.message);
    } finally {
        await browser.close();
    }
}

// Function to fetch TPS data for each Kelurahan
async function fetchTPS(kodeKecamatan, kodeKelurahan) {
    const url = `https://sirekappilkada-obj-data.kpu.go.id/wilayah/pilkada/pkwkk/52/5206/${kodeKecamatan}/${kodeKelurahan}.json`;
    try {
        const response = await axios.get(url);
        return response.data; // Return the TPS data
    } catch (error) {
        console.error(`Failed to fetch TPS for Kelurahan ${kodeKelurahan}:`, error.message);
        return [];
    }
}

// Function to fetch Kelurahan data for each Kecamatan
async function fetchKelurahan(kodeKecamatan) {
    const url = `https://sirekappilkada-obj-data.kpu.go.id/wilayah/pilkada/pkwkk/52/5206/${kodeKecamatan}.json`;
    try {
        const response = await axios.get(url);
        return response.data; // Return the Kelurahan data
    } catch (error) {
        console.error(`Failed to fetch Kelurahan for Kecamatan ${kodeKecamatan}:`, error.message);
        return [];
    }
}

// Main function to process Kecamatan, Kelurahan, and TPS
async function main() {
    const kecamatanFile = './kecamatan.json';

    try {
        const data = fs.readFileSync(kecamatanFile, 'utf-8');
        const kecamatanData = JSON.parse(data);

        for (const kecamatan of kecamatanData) {
            const kodeKecamatan = kecamatan.kode;
            const kelurahanData = await fetchKelurahan(kodeKecamatan);

            for (const kelurahan of kelurahanData) {
                const kodeKelurahan = kelurahan.kode;
                const tpsData = await fetchTPS(kodeKecamatan, kodeKelurahan);

                for (const tps of tpsData) {
                    const kodeTps = tps.kode;

                    // Fetch images for the TPS
                    await fetchImages(
                        kecamatan.nama,
                        kelurahan.nama,
                        tps.nama,
                        kodeKecamatan,
                        kodeKelurahan,
                        kodeTps
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error processing Kecamatan data:', error.message);
    }
}

// Run the script
main();
