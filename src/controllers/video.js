const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const { pipeline } = require("stream/promises");
const util = require("../../lib/util");
const db = require("../DB.js");
const ff = require("../../lib/ff");
const jobQueue = require("../../lib/JobQueue");
const jobs = new jobQueue();

// return all the uploaded video by user
const getVideos = (req, res, handleErr) => {
  db.update();
  const videos = db.videos.filter((video) => {
    return video.userId === req.userId;
  });
  return res.status(200).json(videos);
};

// extract the audio for video file
const extractAudio = async (req, res, handleErr) => {
  const videoId = req.params.get("videoId");
  db.update();
  const video = db.videos.find((video) => {
    return video.videoId === videoId;
  });
  if (video.extractedAudio) {
    return handleErr({
      status: 400,
      message: "The audio has been already extracted for this video",
    });
  }
  const originalVideoPath = `./storage/${videoId}/original${video.extension}`;
  const targetAudioPath = `./storage/${videoId}/audio.aac`;
  try {
    await ff.extractAudio(originalVideoPath, targetAudioPath);

    video.extractedAudio = true;
    db.save();
    return res.status(200).json({
      status: "success",
      message: "The audio was extracted successfully.",
    });
  } catch (error) {
    util.deleteFile(targetAudioPath);
    return handleErr(error);
  }
};

// resize a video file and create a new video file
const resizeVideo = async (req, res, handleErr) => {
  const videoId = req.body.videoId;
  const width = Number(req.body.width);
  const height = Number(req.body.height);
  db.update();
  const video = db.videos.find((video) => {
    return video.videoId === videoId;
  });

  if (!video) {
    return handleErr({
      status: 400,
      message: "The video not found",
    });
  }
  try {
    video.resizes[`${width}x${height}`] = { processing: true };
    db.save();

    jobs.enqueue({
      type: "resize",
      videoId,
      width,
      height,
    });

    return res.status(200).json({
      status: "success",
      message: "The video is now being processed.",
    });
  } catch (error) {
    return handleErr(error);
  }
};

// return video asset to client
const getVideoAsset = async (req, res, handleErr) => {
  const videoId = req.params.get("videoId");
  const type = req.params.get("type");
  db.update();
  const isVideoAvailable = db.videos.find((video) => video.videoId === videoId);
  if (!isVideoAvailable) {
    return handleErr({
      status: 404,
      message: "Video not found!",
    });
  }
  let file;
  let mimeType;
  let fileName;

  switch (type) {
    case "thumbnail":
      file = await fs.open(`./storage/${videoId}/thumbnail.jpg`, "r");
      mimeType = "image/jpeg";
      break;
    case "original":
      file = await fs.open(
        `./storage/${videoId}/original${isVideoAvailable.extension}`,
        "r",
      );
      mimeType = "video/mp4";
      fileName = `${isVideoAvailable.name}${isVideoAvailable.extension}`;
      break;
    case "audio":
      file = await fs.open(`./storage/${videoId}/audio.aac`, "r");
      mimeType = "audio/aac";
      fileName = `${isVideoAvailable.name}-audio.aac`;
      break;
    case "resize":
      const dimensions = req.params.get("dimensions");
      file = await fs.open(
        `./storage/${videoId}/${dimensions}${isVideoAvailable.extension}`,
        "r",
      );
      mimeType = "video/mp4";
      fileName = `${isVideoAvailable.name}-${dimensions}${isVideoAvailable.extension}`;
      break;
  }

  try {
    const stat = await file.stat();
    const fileStream = file.createReadStream();
    if (type != "thumbnail") {
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    }
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);
    res.status(200);
    await pipeline(fileStream, res);

    file.close();
  } catch (error) {
    console.log(error);
  }
};

// upload a video file
const uploadVideo = async (req, res, handleErr) => {
  const fileName = req.headers.filename;
  const extension = path.extname(fileName).substring().toLowerCase();
  const name = path.parse(fileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");
  const FORMAT_SUPPORTED = [".mov", ".mp4"];

  if (FORMAT_SUPPORTED.indexOf(extension) == -1) {
    return handleErr({
      status: 400,
      message: `Only these formats are allowed: ${FORMAT_SUPPORTED.join(", ")}`,
    });
  }
  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullPath = `./storage/${videoId}/original${extension}`;
    const fileDescriptor = await fs.open(fullPath, "w");
    const fileStream = fileDescriptor.createWriteStream();
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;
    await pipeline(req, fileStream);

    // make a thumbnail for the video
    await ff.makeThumbnail(fullPath, thumbnailPath);
    const dimensions = await ff.getDimensions(fullPath);
    db.update();
    db.videos.unshift({
      id: db.videos.length + 1,
      videoId,
      name,
      extension,
      userId: req.userId,
      extractedAudio: false,
      dimensions,
      resizes: {},
    });
    db.save();
    res.status(201).json({
      status: "success",
      videoId,
      message: "Video uploaded successfully",
    });
  } catch (error) {
    await util.deleteFolder(`./storage/${videoId}`);

    if (error.code !== "ECONNRESET") {
      return handleErr(error);
    }
  }
};

const controller = {
  uploadVideo,
  getVideos,
  getVideoAsset,
  extractAudio,
  resizeVideo,
};
module.exports = controller;
