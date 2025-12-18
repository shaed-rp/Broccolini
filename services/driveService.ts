
import { Course } from "../types";

const PROJECT_FOLDER_ID = "1xCVtm2t7XMZxM0ZrkEHLalAZUUsmT1kf";

export interface DriveSyncResult {
  success: boolean;
  errorType?: 'AUTH' | 'NETWORK' | 'PERMISSION' | 'UNKNOWN';
  message?: string;
  id?: string;
  webViewLink?: string;
}

/**
 * Attempts to upload a file to the specified Google Drive folder.
 * Note: Google Drive API v3 requires OAuth2 tokens for uploads. 
 * API Keys (process.env.API_KEY) are rejected with a 401 for POST operations.
 */
export async function uploadToProjectFolder(file: File, course: Course): Promise<DriveSyncResult> {
  try {
    const metadata = {
      name: file.name,
      parents: [PROJECT_FOLDER_ID],
      description: `Project CRISTIAN Ingredient - ${course} Layer Harvest`,
      appProperties: {
        layer: course,
        chef: "Big Query Broccolini",
        origin: "Data Sources"
      }
    };

    const boundary = "-------ProjectCristianBoundary" + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const reader = new FileReader();
    const fileDataPromise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const base64Data = await fileDataPromise;
    
    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelimiter;

    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${process.env.API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Specifically handle the 401 error where API Keys are not allowed for POST
      if (response.status === 401 || errorData?.error?.code === 401) {
        console.warn("Drive API: API Keys are read-only. Upload requires OAuth2.");
        return { 
          success: false, 
          errorType: 'AUTH', 
          message: "Google Drive requires an OAuth2 token (Login) for uploads. Your API key is restricted to Read-Only access." 
        };
      }

      return { 
        success: false, 
        errorType: 'UNKNOWN', 
        message: errorData?.error?.message || "Internal Drive API Error" 
      };
    }

    const result = await response.json();
    return {
      success: true,
      id: result.id,
      webViewLink: `https://drive.google.com/file/d/${result.id}/view`
    };
  } catch (error: any) {
    console.error("Failed to sync to Cloud Garden:", error);
    return { 
      success: false, 
      errorType: 'NETWORK', 
      message: error?.message || "Network error during sync" 
    };
  }
}
