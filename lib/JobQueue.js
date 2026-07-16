/**
 * @typedef {Object} Job
 * @property {"resize"} type
 * @property {string} videoId
 * @property {number} width
 * @property {number} height
 * @property {{ extension: string }} video
 */

const db = require("../src/DB");
const ff = require("./ff");
const util = require("./util");

class JobQueue {
  constructor() {
    /** @type {Job[]} */
    this.jobs = [];

    /** @type {Job | null} */
    this.currentJob = null;
  }
  /**
   * @param {Job} job
   */
  enqueue(job) {
    this.jobs.push(job);
    this.executeNext();
  }

  dequeue() {
    return this.jobs.shift();
  }

  executeNext() {
    if (this.currentJob) {
      return;
    }

    this.currentJob = this.dequeue();
    if (!this.currentJob) return;
    this.execute(this.currentJob);
  }
  /**
   * @param {Job} job
   */
  async execute(job) {
    if (job.type == "resize") {
      db.update();
      const video = db.videos.find((video) => {
        return video.videoId === job.videoId;
      });
      const originalVideoPath = `./storage/${job.videoId}/original${video.extension}`;
      const targetVideoPath = `./storage/${job.videoId}/${job.width}x${job.height}${video.extension}`;

      try {
        await ff.resize(
          originalVideoPath,
          targetVideoPath,
          job.width,
          job.height,
        );
        db.update();
        const video = db.videos.find((video) => {
          return video.videoId === job.videoId;
        });
        video.resizes[`${job.width}x${job.height}`].processing = false;
        db.save();
      } catch (error) {
        util.deleteFile(targetVideoPath);
      }
    }

    this.currentJob = null;
    this.executeNext();
  }
}
module.exports = JobQueue;
