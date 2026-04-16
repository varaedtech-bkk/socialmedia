import cron from "node-cron"; // Import node-cron
import { publishPost } from "./publishPost"
import { storage } from "./storage";
// Function to schedule a post
export const  schedulePost = (postId: number, scheduledTime: Date, timezone: string)=> {
    // Convert the scheduled time to the user's timezone
    const localTime = new Date(
      scheduledTime.toLocaleString("en-US", { timeZone: timezone })
    );
  
    // Generate the cron expression in the user's local time
    const cronExpression = `${localTime.getMinutes()} ${localTime.getHours()} ${localTime.getDate()} ${
      localTime.getMonth() + 1
    } *`;
  
    console.log("Cron Expression:", cronExpression);
    console.log("Scheduled Time (Local):", localTime.toLocaleString());
    console.log("Scheduled Time (UTC):", scheduledTime.toISOString());
  
    cron.schedule(
      cronExpression,
      async () => {
        console.log(`Cron job triggered for post ${postId}`);
        try {
          await publishPost(postId);
          console.log(`Post ${postId} published successfully.`);
        } catch (error) {
          console.error(`Failed to publish post ${postId}:`, error);
        }
      },
      {
        timezone: timezone,
      }
    );
  }

  export async function initializeScheduledPosts() {
      try {
        // Fetch all users from the database
        const users = await storage.getAllUsers();
    
        // Iterate over each user and fetch their scheduled posts
        for (const user of users) {
          const scheduledPosts = await storage.getScheduledPosts(user.id);
    
          // Reinitialize cron jobs for each scheduled post
          for (const post of scheduledPosts) {
            if (post.scheduledTime && post.timezone) {
              const scheduledTime = new Date(post.scheduledTime);
              schedulePost(post.id, scheduledTime, post.timezone);
              console.log(
                `Reinitialized cron job for post ${post.id} (User: ${user.id})`
              );
            }
          }
        }
      } catch (error) {
        console.error("Failed to initialize scheduled posts:", error);
      }
    }