import fs from 'fs';
import readline from 'readline';

async function search() {
  const filePath = 'C:\\Users\\Wael Ragab\\.gemini\\antigravity\\brain\\f0c78ac8-b27f-44be-8fe2-9b0f4156d6e8\\.system_generated\\logs\\transcript.jsonl';
  
  if (!fs.existsSync(filePath)) {
    console.error("Transcript file does not exist:", filePath);
    return;
  }
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching transcript for git pull...");
  for await (const line of rl) {
    const obj = JSON.parse(line);
    const isRelevant = JSON.stringify(obj).includes('git pull') || JSON.stringify(obj).includes('git push');
    if (isRelevant) {
      console.log(`[Step ${obj.step_index}] Type: ${obj.type}`);
      if (obj.content) {
        console.log("Content:", obj.content.substring(0, 1000));
      }
      if (obj.tool_calls) {
        console.log("Tool Calls:", JSON.stringify(obj.tool_calls, null, 2));
      }
    }
  }
  console.log("Search complete.");
}

search();
