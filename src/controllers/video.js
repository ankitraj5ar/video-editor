const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const { pipeline } = require("stream/promises");
const util = require("../../lib/util");
const db = require("../DB.js");
const ff = require("../../lib/ff");
const { measureMemory } = require("vm");

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
      resizes: dimensions,
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
};
module.exports = controller;
