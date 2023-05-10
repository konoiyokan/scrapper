require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');


// Подключение к базе данных
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error(error));

// Определение схемы и модели для коллекции videos
const cadVideoSchema = new mongoose.Schema({
    videoUrl: String,
    fileName: String
});

const CadVideo = mongoose.model('CadVideo', cadVideoSchema);

// Функция для загрузки видео и сохранения по указанному пути
const downloadVideo = async (video, index) => {
    const { videoUrl, fileName } = video;
    const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream'
    });

    const fileNameCut = fileName.substring(0, 100) + '.mp4';

    // Создание директории, если она не существует
    const directoryPath = path.dirname(fileNameCut);
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Сохранение файла
    const writer = fs.createWriteStream(fileNameCut);
    response.data.pipe(writer);

    // Создание отдельного прогрессбара для каждого видео
    const progressBarVideo = new cliProgress.SingleBar({
        format: `Video ${index + 1} | {bar} | {percentage}% | ETA: {eta}s`
    }, cliProgress.Presets.shades_classic);
    progressBarVideo.start(100, 0);

    // Обновление прогрессбара для каждого видео
    const totalLength = parseInt(response.headers['content-length'], 10);
    let downloadedLength = 0;
    response.data.on('data', (chunk) => {
        downloadedLength += chunk.length;
        progressBarVideo.update(downloadedLength / totalLength * 100);
    });

    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            progressBarVideo.stop();
            resolve();
        });
        writer.on('error', reject);
    });
};

// Получение всех записей из коллекции videos

async function downloadAllVideos() {
    try {
        const videos = await CadVideo.find();
        const promises = videos.map((video, index) => downloadVideo(video, index));
        await Promise.all(promises);
        console.log('Загрузка завершена');
        mongoose.connection.close();
        process.exit();
    } catch (err) {
        console.error('Error getting videos from MongoDB', err);
    }
}

downloadAllVideos();