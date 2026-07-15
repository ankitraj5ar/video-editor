const { spawn } = require("child_process");
const { get } = require("http");

const makeThumbnail = (videoPath, thumbnailPath) => {
  //  ffmpeg -i video.mp4 -ss 5 -vframes 1 thumbnail.jpg
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-ss",
      "5",
      "-vframes",
      "1",
      thumbnailPath,
    ]);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`ffmpeg exited with code : ${code}`);
      }
    });
    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const extractAudio = (videoPath, targetAudioPath) => {
  //  ffmpeg -i video.mp4 -vn -c:a copy audio.aac

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-vn",
      "-c:a",
      "copy",
      targetAudioPath,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`ffmpeg exited with code : ${code}\n\n${stderr}`);
      }
    });
    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const resize = (videoPath, targetVideoPath, width, height) => {
  //  ffmpeg -i video.mp4 -vf scale=320:240 -c:a copy video-320x240.mp4

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-vf",
      `scale=${width}:${height}`,
      "-c:a",
      "copy",
      targetVideoPath,
    ]);

    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`ffmpeg exited with code : ${code}\n\n${stderr}`);
      }
    });
    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const getDimensions = (videoPath) => {
  // ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 video.mp4
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      videoPath,
    ]);
    let dimension = "";
    ffprobe.stdout.on("data", (data) => {
      dimension += data.toString("utf-8");
    });
    ffprobe.on("close", (code) => {
      if (code === 0) {
        dimension = dimension.replace(/\s/g, "").split("x");
        resolve({ width: dimension[0], height: dimension[1] });
      } else {
        reject(`ffprobe exited with code : ${code}`);
      }
    });
    ffprobe.on("error", (err) => {
      reject(err);
    });
  });
};
module.exports = { makeThumbnail, getDimensions, extractAudio, resize };
