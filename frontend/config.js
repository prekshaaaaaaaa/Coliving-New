
let SERVER_IP = null; // ⚠️ CHANGE THIS to your local IP address (e.g., '192.168.1.100')

const getApiUrl = () => {
  try {
    const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : true;

    if (isDev) {
      if (!SERVER_IP) {
        try {
          const Constants = require("expo-constants");
          const expoConstants = Constants.default || Constants;
          if (expoConstants?.expoConfig?.hostUri) {
            const debuggerHost = expoConstants.expoConfig.hostUri.split(":")[0];
            if (
              debuggerHost &&
              debuggerHost !== "localhost" &&
              debuggerHost !== " 172.20.44.17"
            ) {
              console.log("Auto-detected IP:", debuggerHost);
              return `http://${debuggerHost}:5000`;
            }
          }
        } catch (e) {
          console.warn("Could not auto-detect IP:", e.message);
        }
      }

      
      if (SERVER_IP) {
        console.log("Using configured IP:", SERVER_IP);
        return `http://${SERVER_IP}:5000`;
      }

      // Fallback - show error
      console.error(
        "SERVER_IP not set! Please update config.js with your local IP address"
      );
      console.error(
        "   Run: ipconfig (Windows) or ifconfig (Mac/Linux) to find your IP"
      );
      return "http://YOUR_LOCAL_IP:5000";
    }

    // Production
    return "https://your-production-api.com";
  } catch (error) {
    console.error("Error getting API URL:", error);
    return "http://localhost:5000";
  }
};

// Safely export API_BASE_URL
let API_BASE_URL;
try {
  API_BASE_URL = getApiUrl();
  // If getApiUrl returned a placeholder or invalid value, discard it so
  // we don't accidentally build URLs like http://null:5000
  if (
    typeof API_BASE_URL === 'string' &&
    (API_BASE_URL.includes('YOUR_LOCAL_IP') || API_BASE_URL.includes('null') || API_BASE_URL.includes('undefined'))
  ) {
    console.warn('Discarding invalid API_BASE_URL:', API_BASE_URL);
    API_BASE_URL = null;
  }
} catch (error) {
  console.error("Error initializing API_BASE_URL:", error);
  API_BASE_URL = null;
}

export { API_BASE_URL };

// Helper function to make API calls with better error handling
export const apiCall = async (endpoint, options = {}) => {
  try {
    // Choose a working base for the first attempt. If API_BASE_URL is not set
    // or was discarded above, use a reasonable default (127.0.0.1) so the first
    // fetch triggers a network error and the fallback logic runs.
    const baseForAttempt =
      API_BASE_URL && typeof API_BASE_URL === 'string' ? API_BASE_URL.replace(/\/$/, '') : 'http://127.0.0.1:5000';

    const url = `${baseForAttempt}${endpoint}`;

   
    if (url.includes("YOUR_LOCAL_IP")) {
      return {
        success: false,
        error:
          'SERVER_IP not configured!\n\nPlease update config.js:\n1. Find your IP: Run "ipconfig" (Windows) or "ifconfig" (Mac/Linux)\n2. Update SERVER_IP in config.js with your IPv4 address\n3. Make sure backend server is running on port 5000',
      };
    }

  console.log("Making API call to:", url);

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    };

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    // Create timeout controller for React Native compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const fetchOptions = {
      ...options,
      headers,
      signal: controller.signal,
    };

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    // Try to parse JSON response
    let data;
    const contentType = response.headers.get("content-type");

    try {
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Try to parse as JSON even if content-type is wrong
        try {
          data = JSON.parse(text);
        } catch {
          data = text ? { message: text } : {};
        }
      }
    } catch (parseError) {
      console.error("Error parsing response:", parseError);
      data = { error: "Failed to parse server response" };
    }

    // Check if response is ok
    if (!response.ok) {
      return {
        success: false,
        error:
          data.error ||
          data.message ||
          `HTTP error! status: ${response.status}`,
      };
    }

    // Return success response
    return {
      success: data.success !== undefined ? data.success : true,
      data: data,
    };
  } catch (error) {
    console.error("API Call Error:", error);

    // Handle timeout
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return {
        success: false,
        error:
          "Request timeout. The server is not responding. Please check:\n1. Backend server is running\n2. Correct IP address in config.js\n3. Firewall is not blocking port 5000",
      };
    }

    // Check for network errors
    if (
      error.message.includes("Network request failed") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError")
    ) {
      return {
        success: false,
        error:
          'Network request failed!\n\nTroubleshooting:\n1. Check your internet connection\n2. Ensure backend server is running: "node server.js" in backend folder\n3. Verify IP address in config.js matches your computer\'s IP\n4. Make sure phone and computer are on same WiFi\n5. Check firewall allows port 5000',
      };
    }

    return {
      success: false,
      error: error.message || "An unexpected error occurred. Please try again.",
    };
  }
};
