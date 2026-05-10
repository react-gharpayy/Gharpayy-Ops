// Quick test script to validate improved lead parser
import { parseLead, splitLeads } from './src/lib/lead-identity/parser';

const sampleLeads = [
  // Test 0: Problematic Gharpayy template (single-line, emoji-heavy)
  `*GHARPAYY*⚡️ _Your SuperStay Awaits!_   Hey, I’m *Aayushi from Gharpayy* here to help you find *the* most  homely accommodation just for *you*. Get *best PG in 10 minutes*? Just take *18 SEC* to fill this  ⚡🔥   📝 *Name:*  Muhammed Irfan PK 📱 *Phone:*  9656442497 ✉️ *Email:*  muhammedirfanpk40@gmail.com 📍 *Preferred Location/Landmark(Map link):*  btm 💰 *Budget Range:* (₹8-12k, ₹13-16k, ₹21-27k monthly)  8-12 📆 *Move-in Date:* july 6th morning 👨‍💻  (Student/Working)  student 🏢 *Room* (Shared/Private)  shared me and my friends 👫 *NEED* (Boys/Girls/Coed)  boys ✨ *Special Requests:* (If any)  *Gharpayy.com*  📞 83073 96042`,

  // Test 1: Simple inline format (Name + Phone)
  "Ayush 7970892124 Bellandur 8-12k August 1st Shared and private Coed",

  // Test (SG palya) - expecting fullAddress to be set from location
  `📝 *Name:*  kalle Sravya 📱 *Phone:*  6363153198 ✉️ *Email:*  jyothikalle22@gmail.com 📍 *Preferred Location/Landmark(Map link):*  SG palya 💰 *Budget Range:* (₹8-12kmonthly) 📆 *Move-in Date:*  16th July 👨‍💻  (Student/Working) : working 🏢 *Room* (Shared/Private)  shared  👫 *NEED* (Girls/Coed) coliving is preferred  ✨ *Special Requests:*`,

  // Test (Vaibhav) - expects inBLR true, type Working, and quality populated
  `*GHARPAYY*⚡️ _Your SuperStay Awaits!_ 📝 *Name:*  Vaibhav Wanjare 📱 *Phone:*  9021655986 ✉️ *Email:*  vaibhav.wanjare@yahoo.con 📍 *Preferred Location/Landmark(Map link):*  near rmz Ecoworld 💰 *Budget Range:* (₹8-12k, ₹13-16k, ₹21-27k monthly)  8 to 12k budget 📆 *Move-in Date:*   👨‍💻  (Student/Working)  - Working 🏢 *Room* (Shared/Private)  - Private 👫 *NEED* (Boys/Girls/Coed)  - Boys/coed ✨ *Special Requests:*`,
  
  // Test 2: WhatsApp forwarded with timestamp
  `[1:04 PM, 26/6/2025] +91 94948 64426: Move ib next month
[1:05 PM, 26/6/2025] Gharpayy: looking for boys / girls / coed ?
[1:05 PM, 26/6/2025] +91 94948 64426: Boys`,

  // Test 3: Emoji-heavy format with name
  `📝 *Name:*  Nidha Mohammed  
📱 *Phone:*  8075889613 
✉️ *Email:*  nidhamohammed575@gmail.com 
📍 *Preferred Location/Landmark[Map Link]:*  HSR Layout  
💰 *Budget Range:* ₹8-12k or ₹13-16k 
📆 *Move-in Date:*  18th June 2025 (Working)   
🏢 *Room* Private 
👫 *NEED* Girls/Coed`,

  // Test 4: Key-value format
  `Name: Kushal Rakesh Suryawanshi  
Phone: 9611447737 
Email: Kushalsuryawanshi2017@gmail.com  
Location: Bannerghatta area near Maven silicon company banglore`,

  // Test 5: Mixed format with missing name initially
  `Pravallika  7093009254 repuripravallika@gmail.com Koramangala  10k-12k July 4th Interning  Two share Girls/co Gym facility`,

  // Test 6: Very minimal info
  `Carol 9072650276 carolrichard5302@gmail.com  Near to https://maps.app.goo.gl/Xs4koHCsheS3XnWg9 Don't know  Working  Shared  Girls Laundry + ironing`,

  // Test 7: Name on separate line
  `Roshan
8050059003
vara962501@gmail.com
Koramangala (near nexus mall)
8-12k
July 5th 2025(tentative)
Student pursuing IAS coaching
Private or double sharing
Boys
Need a calm and peaceful environment for study`,
];

console.log("=== LEAD PARSER TEST ===\n");

for (let i = 0; i < sampleLeads.length; i++) {
  console.log(`\n--- Test ${i + 1} ---`);
  console.log(`Input:\n${sampleLeads[i].substring(0, 100)}${sampleLeads[i].length > 100 ? '...' : ''}\n`);
  
  const parsed = parseLead(sampleLeads[i]);
  if (parsed) {
    console.log(`✅ Parsed successfully:`);
    console.log(`   Name: "${parsed.name}" (confidence: ${parsed.confidence?.name?.toFixed(2) ?? 'N/A'})`);
    console.log(`   Phone: ${parsed.phone}`);
    console.log(`   Email: ${parsed.email}`);
    console.log(`   Location: ${parsed.location}`);
    console.log(`   Budget: ${parsed.budget}`);
    console.log(`   Move-in: ${parsed.moveIn}`);
    console.log(`   Type: ${parsed.type}`);
    console.log(`   Room: ${parsed.room}`);
    console.log(`   Need: ${parsed.need}`);
    console.log(`   Areas: ${parsed.areas.join(', ')}`);
  } else {
    console.log(`❌ Failed to parse`);
  }
}

console.log("\n=== BULK LEAD SPLITTING TEST ===\n");
const bulkData = sampleLeads.slice(0, 3).join("\n\n");
const split = splitLeads(bulkData);
console.log(`Detected ${split.length} leads in bulk paste`);
split.forEach((lead, i) => {
  const parsed = parseLead(lead);
  if (parsed) {
    console.log(`  Lead ${i + 1}: ${parsed.name} (${parsed.phone})`);
  }
});
