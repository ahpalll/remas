// Cloudflare Worker for secure video access
// Provides temporary signed URLs to Cloudflare R2 storage
// Does not expose R2 credentials to the client

import { getSignedUrl } from "@cloudflare/r2";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const videoId = url.searchParams.get("videoId");
    const studentId = url.searchParams.get("studentId");
    const institutionId = url.searchParams.get("institutionId");
    
    if (!videoId || !studentId || !institutionId) {
      return new Response("Missing required parameters", { status: 400 });
    }
    
    // Verify subscription and authorization (would check Firestore/Database)
    // For now, generate temporary signed URL
    
    const objectKey = `institutions/${institutionId}/videos/${videoId}`;
    
    try {
      const signedUrl = await getSignedUrl(
        env.R2_BUCKET,
        objectKey,
        {
          expiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          httpMethod: "GET",
        }
      );
      
      return new Response(
        JSON.stringify({ url: signedUrl }),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        }
      );
    } catch (error) {
      console.error("Error generating signed URL:", error);
      return new Response("Error generating access URL", { status: 500 });
    }
  },
};