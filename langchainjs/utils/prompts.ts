// Lab extraction and matching prompts based on Python implementation

export const LAB_EXTRACTION_PROMPT = `
You are a medical case manager tasked with processing a lab test report and extracting key information. Your goal is to retrieve necessary information for the lab test report data.

Instructions:
1. The user specified the lab test report is in this language: {language}, use this for context awareness.
2. Extract the relevant information and map it into the following JSON structure: {format_instructions}.
3. Ensure that the **result** field contains only the result value of a lab test parameter without its unit. If the result contains Hebrew text, translate it to English (e.g., 'לא בוצע' → 'Not performed').
4. Place any accompanying unit of measurement into the **units** field separately.
5. If the value and unit are combined (e.g., "120 mg/dL"), extract **120** into the **result** field and **mg/dL** into the **units** field.
6. If the lab report contains a range, make sure it's not combined with the unit in the **range** field. If the range contains Hebrew text, translate it to English (e.g., 'קטן מ-200' → '>200').
7. Ensure you identify any additional note or interpretation or comment or explanation associated with a lab test parameter from the doctor. If you find any, place it in the **comment** field. Please differentiate it from the result value of the parameter. Ensure you put the result value in the **result** field and put a comment or interpretation or explanation you find in the **comment** field.
8. If the original comment field is in Hebrew, translate it to English and place the translation in the **comment_english** field.

Context data:
- Lab test report data: {lab_test_report_data}
`;

export const LAB_REPORT_MATCHING_PROMPT = `
You are a medical case manager tasked with processing a lab test report and extracting key information. Your goal is to map lab report information with the existing data in {context}.

### **Instructions:**
- The user specified the lab test report is in this language: **{language}**. Use this for context awareness.
- If the file is not in English, you are expected to translate it into English and maintain the medical context with correct jargon
- Extract the relevant information and map it into the following JSON structure: **{format_instructions}**.
- Please analyse and return ALL the results in the report. Make sure you do not miss out on ANY parameter and its result that is included in the file.
- Make sure the indicators are returned according to the mapping for each type!
- Please list everything in English.
- Please do not make up information.

### **Matching Logic:**
- **Priority Rule:** Always prioritize the **lab test name** and **parameter name** over the **test type** when matching data. The test type should only be considered as a secondary factor.
- **Use the following classification for matches:**
 - **Similar (Typo):** The lab report name and parameter name match conceptually but may have formatting differences, such as typos, abbreviations, or case mismatches. The test type is secondary in this case.
 - **Alternative:** The lab report name and parameter name match conceptually, but the test type uses alternative naming. Lab test and parameter names take precedence.
 - **Unknown:** The lab test name and parameter name do not exist in the index under any test type.

---

### **Context Data:**
- **Lab report data:** {lab_report_data}

### **Question:**
- **{question}**
`;

// Helper function to format prompts with variables
export function formatPrompt(template: string, variables: Record<string, string>): string {
  let formatted = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    formatted = formatted.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return formatted;
}

// Specific prompt formatters
export function formatLabExtractionPrompt(
  labTestReportData: string,
  language: string,
  formatInstructions: string
): string {
  return formatPrompt(LAB_EXTRACTION_PROMPT, {
    lab_test_report_data: labTestReportData,
    language: language,
    format_instructions: formatInstructions
  });
}

export function formatLabMatchingPrompt(
  context: string,
  labReportData: string,
  language: string,
  question: string,
  formatInstructions: string
): string {
  return formatPrompt(LAB_REPORT_MATCHING_PROMPT, {
    context: context,
    lab_report_data: labReportData,
    language: language,
    question: question,
    format_instructions: formatInstructions
  });
}

// Physician matching prompt
export const PHYSICIAN_MATCHING_PROMPT = `
You are a medical case manager tasked with matching physician information from a lab report with existing physician data in the database.

### **Instructions:**
- The user specified the language is: **{language}**. Use this for context awareness.
- Extract the relevant information and map it into the following JSON structure: **{format_instructions}**.
- Match the physician information with the most similar physician from the context data.
- Consider name variations, abbreviations, and common medical titles.

### **Matching Logic:**
- **Exact:** Perfect match of first name and last name
- **Similar; Typo:** Names match with minor spelling differences or formatting variations
- **Alternative:** Names match using alternative forms (e.g., nicknames, initials)
- **Unknown:** No matching physician found in the database

### **Context Data (Available Physicians):**
{context}

### **Physician Information to Match:**
{physician_info}

### **Question:**
{question}
`;

// Medical facility matching prompt
export const FACILITY_MATCHING_PROMPT = `
You are a medical case manager tasked with matching medical facility information from a lab report with existing facility data in the database.

### **Instructions:**
- The user specified the language is: **{language}**. Use this for context awareness.
- Extract the relevant information and map it into the following JSON structure: **{format_instructions}**.
- Match the facility information with the most similar medical facility from the context data.
- Consider facility name variations, abbreviations, and alternative names.

### **Matching Logic:**
- **Exact:** Perfect match of facility name
- **Similar; Typo:** Names match with minor spelling differences or formatting variations
- **Alternative:** Names match using alternative forms (e.g., abbreviations, common names)
- **Unknown:** No matching facility found in the database

### **Context Data (Available Medical Facilities):**
{context}

### **Facility Information to Match:**
{facility_info}

### **Question:**
{question}
`;

// Physician matching prompt formatter
export function formatPhysicianMatchingPrompt(
  context: string,
  physicianInfo: string,
  language: string,
  question: string,
  formatInstructions: string
): string {
  return formatPrompt(PHYSICIAN_MATCHING_PROMPT, {
    context: context,
    physician_info: physicianInfo,
    language: language,
    question: question,
    format_instructions: formatInstructions
  });
}

// Facility matching prompt formatter
export function formatFacilityMatchingPrompt(
  context: string,
  facilityInfo: string,
  language: string,
  question: string,
  formatInstructions: string
): string {
  return formatPrompt(FACILITY_MATCHING_PROMPT, {
    context: context,
    facility_info: facilityInfo,
    language: language,
    question: question,
    format_instructions: formatInstructions
  });
}
