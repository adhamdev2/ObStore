import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

// Initialize env exactly like the main router
const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.dev";
dotenv.config({ path: path.resolve(process.cwd(), `../${envFile}`) });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";
const API_URL = "http://127.0.0.1:3004/api/auth/me";

async function runTest() {
    console.log("==================================================");
    console.log("🚀 Starting Aggressive Auth Middleware Test...");
    console.log("==================================================\n");

    // 1. Generate a valid token
    const testToken = jwt.sign(
        { id: "123456789", username: "TesterPro", avatar: "" }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
    );
    
    console.log("🔑 Generated Test JWT:", testToken.substring(0, 30) + "...\n");

    // ----------------------------------------
    // TEST 1: No Cookie (Should Fail)
    // ----------------------------------------
    console.log("➡️ TEST 1: Request WITHOUT cookie");
    try {
        await axios.get(API_URL);
        console.log("❌ ERROR: Test 1 should have failed but passed!\n");
    } catch (err: any) {
        if (!err.response) {
            console.log(`❌ Network Error: Make sure your API is running on ${API_URL}`);
            console.log(err.message);
        } else {
            console.log(`✅ Expected Failure. Status: ${err.response.status} - Reason:`, err.response.data);
        }
        console.log("");
    }

    // ----------------------------------------
    // TEST 2: Valid Cookie
    // ----------------------------------------
    console.log("➡️ TEST 2: Request WITH correct 'auth_session' cookie");
    try {
        const res = await axios.get(API_URL, {
            headers: {
                Cookie: `auth_session=${testToken}`
            }
        });
        
        console.log(`✅ Success! Response Status: ${res.status}`);
        console.log("✅ Response Data:", res.data);
    } catch (err: any) {
        if (!err.response) {
             console.log(`❌ Network Error: API is not reachable at ${API_URL}`);
             console.log(err.message);
        } else if (err.response.status === 404 && err.response.data?.error === "User not found") {
             console.log("✅ Partial Success: The middleware successfully authorized the token! (User just doesn't exist in the DB, which is expected)");
        } else {
             console.log("❌ Failed! Route completely rejected the auth token!");
             console.error(`Status: ${err.response.status}`, err.response.data);
        }
    }
}

runTest();
