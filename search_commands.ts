import fs from 'fs';
import readline from 'readline';

async function search() {
  const filePath = 'C:\\Users\\Wael Ragab\\.gemini\\antigravity\\brain\\a478aa9b-2aa2-4013-9da7-ee059a692a7a\\.system_generated\\logs\\transcript.jsonl';
  
  if (!fs.existsSync(filePath)) {
    console.error("Transcript file does not exist:", filePath);
    return;
  }
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Searching transcript for command executions...");
  for await (const line of rl) {
    const step = JSON.parse(line);
    if (step.type === 'RUN_COMMAND' || (step.tool_calls && step.tool_calls.some((t: any) => t.name === 'run_command'))) {
      console.log(`[Step ${step.step_index}] CommandLine: ${JSON.stringify(step.tool_calls?.[0]?.args?.CommandLine || step.content)}`);
      if (step.status === 'DONE' && step.content) {
        console.log(`  Output: ${step.content.substring(0, 200)}...`);
      }
    }
  }
  console.log("Search complete.");
}

search();
