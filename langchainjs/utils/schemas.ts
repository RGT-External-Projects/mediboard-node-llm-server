// JSON schemas for structured output parsing with exact descriptions from Python models

export const labExtractionSchema = {
  type: 'object',
  description: 'Schema for extracting lab test data from medical documents',
  properties: {
    patient_info: {
      type: 'object',
      description: 'Details of the patient details in the uploaded lab report',
      properties: {
        first_name: {
          type: 'string',
          description:
            'The first name of the patient, extracted directly from the uploaded lab test report.',
        },
        last_name: {
          type: 'string',
          description:
            'The last name of the patient, extracted directly from the uploaded lab test report.',
        },
      },
    },
    physician_info: {
      type: 'object',
      description: 'Details of the referring or treating physician.',
      properties: {
        first_name: {
          type: 'string',
          description:
            'The first name of the referring or treating physician, extracted from the uploaded lab test report.',
        },
        last_name: {
          type: 'string',
          description:
            'The last name of the referring or treating physician, extracted from the uploaded lab test report.',
        },
      },
    },
    medical_facility: {
      type: 'object',
      description: 'Details of the medical facility where the tests were conducted.',
      properties: {
        facility_name: {
          type: 'string',
          description:
            'The name of the medical facility where the tests were conducted, extracted from the lab test report.',
        },
        location: {
          type: 'string',
          description:
            'The geographical location of the medical facility, if available, extracted and matched with the Institutes index.',
        },
      },
    },
    is_lab_report: {
      type: 'boolean',
      description:
        'Determine if the document is a lab report by carefully analyzing key medical indicators like test results, reference ranges, patient vitals, lab facility details, physician information, and medical terminology. The document should contain structured clinical/laboratory data before being classified as a lab report.',
    },
    test_date: {
      type: 'string',
      description: 'The date when the lab test was conducted or reported.',
    },
    lab_reports: {
      type: 'array',
      description:
        'A comprehensive list of all laboratory test results and parameters from the report. This should include test names, numeric values, units, reference ranges, and any flags or annotations. The extraction should be thorough and complete, capturing both routine and specialized tests, without omitting any results present in the source document.',
      items: {
        type: 'object',
        properties: {
          index: {
            type: 'string',
            title: 'Index',
            description:
              'The sequential index number of the lab test parameter (1, 2, 3, etc.) in the order they appear in the report. This field must never be null - assign sequential numbers starting from 1.',
          },
          name: {
            type: 'string',
            description:
              "The parameter name exactly as displayed in the lab report. Extract the full name including any prefixes, suffixes, or codes. Examples in English: 'Glucose', 'WBC', 'HDL Cholesterol', 'AST (SGOT)', 'TSH (Thyroid Stimulating Hormone)', 'BUN (Blood Urea Nitrogen)', 'MCHC', 'Vitamin D, 25-OH', 'Anti-Thyroid Peroxidase Ab', 'T. gondii IgG'. Examples in Hebrew: 'גלוקוז', 'ספירת תאים לבנים', 'כולסטרול HDL', 'אלנין אמינוטרנספראז (ALT)', 'הורמון מעורר בלוטת התריס (TSH)', 'אוריאה בדם (BUN)', 'אלבומין', 'תאי דם אדומים (RBC)', 'המוגלובין'. For bilingual entries, preserve exactly as shown: 'ALT/אלנין אמינוטרנספראז', 'כולסטרול HDL/HDL Cholesterol'. For special characters or formatting, maintain as presented: 'β-hCG', 'α-Fetoprotein', 'גאמא GT', 'Vitamin B₁₂'. Field naming variations in English: 'Test', 'Parameter', 'Analyte', 'Component', 'Measurement', 'Test Name', 'Exam', 'Determination', 'Assay'. Field naming variations in Hebrew: 'פרמטר', 'בדיקה', 'מדד', 'רכיב', 'אנליט', 'שם הבדיקה', 'מרכיב', 'קטלוג', 'פריט'.",
          },
          result_value_type: {
            type: 'string',
            title: 'Result Value Type',
            description:
              '\n            The value type of the lab test result from test_params.result based on the categories defined in ParameterValueTypeInfo.\n        Each parameter result must be classified into a single **value type** from the following categories:\n            1. Numeric value = The result is a number (including negatives and fractions like 0.5). Return as **numeric_value** only.\n            2. Negative / Positive = The result is a positive or negative. An example is "Negative", "Positive", "Pos", "Neg". Return as **negative_positive** only.\n            3. Operator value = The result is a number (including negatives and fractions) combined with an operator, or a number with a compound expression (e.g., <, >, +, >=, <=). An example is <2, +50, less than 3, greater than 4, etc. Return as **operator_value** only.\n            4. Blank = The result is textual and does not fit any of the above categories (e.g., "Normal", "Undeteramable", "See attached report", "", null). Return as **blank** only.\n        ',
            enum: ['numeric_value', 'negative_positive', 'operator_value', 'blank'],
          },
          result: {
            type: ['string', 'number', 'null'],
            description:
              "The patient's actual test measurement or finding. Extract only the patient's specific result value. Do not include any reference values or normal ranges here. Look for the value that appears before units or as the primary finding. Example: In '70 mg/dl', extract '70' as the result. For Hebrew text results, translate to English: 'חיובי' → 'Positive', 'תקין' → 'Normal', 'לא נמצא' → 'Not Found', 'לא בוצע, דגימה מולחמית' → 'Not performed, hemolyzed sample'. Keep numeric values unchanged (e.g., '5.2' stays as '5.2').",
          },
          range: {
            type: 'string',
            description:
              "The expected normal or reference values for comparison. Look for values labeled as 'range', 'normal', 'reference', or appearing in comments. Include single values that appear in comments with matching units. Extract complete ranges like '3.5-5.2' or '10-100'. For a single reference value like '283 mg/dl' in comments, extract '283'. For Hebrew text, translate to English with standardized operators: 'קטן מ' → '<' (smaller than becomes less than), 'גדול מ' → '>' (greater than remains greater than), 'עד' → '<=' (up to), 'גברים:' → 'Men:', 'נשים:' → 'Women:'. Examples: 'קטן מ-200' → '<200', 'גדול מ-50' → '>50', 'עד 100' → '<=100', 'גברים: 13.5-17.5, נשים: 12.0-15.5' → 'Men: 13.5-17.5, Women: 12.0-15.5'. If no reference range is provided, set to null.",
          },
          units: {
            type: 'string',
            description:
              "The unit of measurement for the test result and reference ranges. Extract exactly as shown, including special characters and formatting. Examples include: Basic units: 'mg/dL', 'g/dL', 'μg/dL', 'ng/mL', 'pg/mL', 'mEq/L', 'mmol/L', 'μmol/L', 'U/L', 'IU/L', 'mIU/L', '%', 'g/L'. Cell count units: 'x10^9/L', 'x10^12/L', 'x10³/μL', 'x10⁶/μL', '/μL', '/hpf', '/lpf', '/mm³'. Time-based units: 'sec', 'min', 'hr', 'mL/min', 'mL/min/1.73m²'. Ratio units: 'ratio', 'index', 'AU', 'S/CO', 'titer'. Hebrew units: 'מ״ג/ד״ל', 'גרם/ד״ל', 'יחידות/ליטר', 'מ״מול/ליטר', 'אחוזים', 'שניות'. Combined units: 'cells/mm³', 'mmHg', 'gr/dL', 'fL', 'pg/cell'. For qualitative results where no unit is applicable (like 'Positive'/'Negative'), set to null. If units appear with ranges ('3.5-5.0 mg/dL'), extract only the unit portion ('mg/dL'). Field naming variations in English: 'Units', 'Unit', 'Measurement Units', 'Unit of Measure', 'UOM', 'Reported In', 'Scale', 'Metrics', 'Units of Measurement'. Field naming variations in Hebrew: 'יחידות', 'יחידת מידה', 'מידה', 'סקלה', 'יחידות מדידה', 'נמדד ב', 'יח׳', 'יח׳ מדידה', 'מטריקה'.",
          },
          test_type: {
            type: 'string',
            description:
              "The category or group of laboratory tests that the parameter belongs to. Usually appears as a header or section title. Examples include: Examples in English: 'Complete Blood Count (CBC)', 'Comprehensive Metabolic Panel (CMP)', 'Lipid Profile', 'Thyroid Function Tests', 'Liver Function Tests', 'Urinalysis', 'Hormone Panel', 'Allergy Panel', 'Infectious Disease Serology', 'Vitamin Panel', 'Electrolytes', 'Iron Studies', 'Coagulation Studies'. Examples in Hebrew: 'ספירת דם מלאה', 'פאנל מטבולי מקיף', 'פרופיל שומנים', 'בדיקות תפקודי בלוטת התריס', 'תפקודי כבד', 'בדיקת שתן', 'פאנל הורמונלי', 'בדיקות אלרגיה', 'סרולוגיה למחלות זיהומיות', 'בדיקות ויטמינים', 'אלקטרוליטים', 'בדיקות ברזל', 'בדיקות קרישה'. Bilingual examples: 'ספירת דם מלאה (CBC)', 'בדיקות תפקודי כבד (Liver Function Tests)', 'פרופיל שומנים (Lipid Profile)'. If test type is not explicitly stated, attempt to infer from context, parameter grouping, or report structure. For standalone tests, use a general category: 'Specialized Tests', 'בדיקות מיוחדות'. Field naming variations in English: 'Test Type', 'Panel', 'Profile', 'Test Category', 'Battery', 'Test Group', 'Panel Type', 'Test Classification', 'Laboratory Section', 'Department'. Field naming variations in Hebrew: 'סוג בדיקה', 'פאנל', 'פרופיל', 'קטגוריית בדיקה', 'סוללת בדיקות', 'קבוצת בדיקות', 'סיווג בדיקה', 'מחלקה מעבדתית', 'מדור'.",
          },
          comment: {
            type: 'string',
            description:
              "Any additional notes, interpretations, or recommendations related to the test result. Extract the complete text as shown. Examples include: Clinical interpretation examples: 'Consistent with iron deficiency anemia', 'Suggestive of viral infection', 'Compatible with hypothyroidism', 'May indicate dehydration', 'Consider renal function assessment'. Sample quality issues: 'Hemolyzed sample', 'Lipemic specimen', 'Sample insufficient for complete analysis', 'Results may be affected by medication', 'Recommend recollection'. Follow-up recommendations: 'Recommend follow-up in 3 months', 'Consider endocrinology referral', 'Repeat test after fasting', 'Correlate with clinical symptoms'. Technical notes: 'Verified by repeat analysis', 'Confirmed by alternate method', 'Manual differential performed', 'Second sample requested'. Hebrew examples: 'מתאים לאנמיה מחוסר ברזל', 'מרמז על זיהום ויראלי', 'ממצאים תואמים תת-פעילות בלוטת התריס', 'מומלץ מעקב תוך 3 חודשים', 'דגימה המוליטית', 'יש לשקול הפניה לאנדוקרינולוג', 'מומלץ לחזור על הבדיקה בצום'. Alerts: 'Critical value called to Dr. Smith on 03/11/2025', 'Results require immediate clinical attention', 'ערך קריטי, דווח לד״ר כהן ב-11/03/2025', 'תוצאות מחייבות התייחסות קלינית מיידית'. Comments may appear in footnotes, special sections, or directly adjacent to results. Include all relevant comments for the specific parameter. Field naming variations in English: 'Comment', 'Notes', 'Remarks', 'Interpretation', 'Clinical Notes', 'Additional Information', 'Observation', 'Comment/Interpretation', 'Clinical Significance', 'Special Notes'. Field naming variations in Hebrew: 'הערה', 'הערות', 'פירוש', 'פרשנות', 'הערות קליניות', 'מידע נוסף', 'תצפית', 'משמעות קלינית', 'הערות מיוחדות', 'הסבר'.",
          },
          comment_english: {
            type: 'string',
            description:
              "English translation of the comment field when the original comment is in Hebrew. This field should only be populated when the comment field contains Hebrew text. The translation should maintain medical terminology accuracy and context. If the original comment is already in English, this field should remain empty (null). Examples: Hebrew comment: 'מתאים לאנמיה מחוסר ברזל' → comment_english: 'Consistent with iron deficiency anemia', Hebrew comment: 'מרמז על זיהום ויראלי' → comment_english: 'Suggestive of viral infection', Hebrew comment: 'מומלץ מעקב תוך 3 חודשים' → comment_english: 'Recommend follow-up in 3 months', Hebrew comment: 'יש לשקול הפניה לאנדוקרינולוג' → comment_english: 'Consider endocrinology referral', Hebrew comment: 'ערך קריטי, דווח לד״ר כהן ב-11/03/2025' → comment_english: 'Critical value, reported to Dr. Cohen on 11/03/2025'.",
          },
        },
        required: ['name'],
      },
    },
  },
  required: ['lab_reports'],
};

export const physicianMatchingSchema = {
  type: 'object',
  description: 'Schema for physician matching results with confidence scoring',
  properties: {
    matched_id: {
      type: 'number',
      description: 'The id for the matched physician, extracted from the context.',
    },
    matched_title: {
      type: 'string',
      description: 'The title for the matched physician, extracted from the context.',
    },
    matched_name: {
      type: 'string',
      description:
        'The doctorName for the matched physician, extracted from the context.',
    },
    matched_lastname: {
      type: 'string',
      description:
        'The doctorLastName for the matched physician, extracted from the context.',
    },
    match_info: {
      type: 'object',
      description:
        'Matching information for the physician details, compared against the extracted context data',
      properties: {
        match_score: {
          type: 'string',
          enum: ['Similar; Typo', 'Alternative', 'Unknown'],
          description:
            "Score indicating the quality of the match to the index. Examples include  'Similar; Typo', 'Alternative', or 'Unknown'.",
        },
        reason: {
          type: 'string',
          description:
            'Explanation for the match score, providing context about the matching decision.',
        },
      },
      required: ['match_score', 'reason'],
    },
  },
  required: [
    'matched_id',
    'matched_title',
    'matched_name',
    'matched_lastname',
    'match_info',
  ],
};

export const facilityMatchingSchema = {
  type: 'object',
  description: 'Schema for medical facility matching results with confidence scoring',
  properties: {
    value_name: {
      type: 'string',
      description:
        'The value data from the context matched institution, extracted from the context.',
    },
    matched_display_name: {
      type: 'string',
      description:
        'The display name for the matched institution, extracted from the context.',
    },
    matched_id: {
      type: 'number',
      description: 'The id of the matched medical facility, extracted from the context.',
    },
    match_info: {
      type: 'object',
      description:
        'Matching information for the facility details, compared against the extracted context data.',
      properties: {
        match_score: {
          type: 'string',
          enum: ['Similar; Typo', 'Alternative', 'Unknown'],
          description:
            "Score indicating the quality of the match to the index. Examples include  'Similar; Typo', 'Alternative', or 'Unknown'.",
        },
        reason: {
          type: 'string',
          description:
            'Explanation for the match score, providing context about the matching decision.',
        },
      },
      required: ['match_score', 'reason'],
    },
  },
  required: ['value_name', 'matched_display_name', 'matched_id', 'match_info'],
};

export const labReportMatchingSchema = {
  type: 'object',
  description: 'Schema for lab parameter matching results with unit conversion support',
  properties: {
    matched_id: {
      type: ['number', 'null'],
      description:
        'The unique identifier of the matched lab test, derived from the matched context data.',
    },
    matched_parameter: {
      type: ['string', 'null'],
      description:
        'The parameter of the matched lab test, derived from the matched context data.',
    },
    match_info: {
      type: 'object',
      description:
        'Matching information for the lab test details using the parameter name, compared against the context',
      properties: {
        match_score: {
          type: 'string',
          enum: ['Similar; Typo', 'Alternative', 'Unknown'],
          description: `
        1. Similar; Typo:
          * The options
            > Parameter name:
              # Exact match in the parameter name
              # Minor variations in:
                - Case
                - Spacing
                - Punctuation
                - Units
            > The parameter appears under the correct test type OR a test type with minor variations (capitalization, spacing, etc.)
          * Examples:
            > From file: {Parameter} =  {Hemoglobin} under {Test} = {Complete Blood Count} | From Database (=index): {Parameter} = {Hemoglobin} under {test_type} = {Complete Blood Count} Result: Similar; Typo (exact match for both)
            > From file: {Parameter} =  {glucose} under {Test}= {metabolic panel} | From Database (=index): {Parameter} = {Glucose} under {test_type}= {Metabolic Panel} Result: Similar; Typo (case difference only)
            > From file: {Parameter} =  {T.S.H} under {Test} = {Thyroid Panel} | From Database (=index): {Parameter} = {TSH} under {test_type} = {Thyroid Panel} Result: Similar; Typo (punctuation difference only)
            > From file: {Parameter} =  {white blood cell} under {test} = {complete blood count} | From Database (=index): {Parameter} = {White Blood Cell} under {test_type} = {Complete Blood Count} Result: Similar; Typo (case differences only)
            > From file: {Parameter} =  {Eosinnophils} under {test} = {CBC} | From Database (=index): {Parameter} = {Eosinophils} under {test_type} = {CBC} Result: Similar; Typo (spelling error with doubled 'n')
            > From file: {Parameter} =  {Platlets} under {test} = {COMPLETE BLOOD COUNT} | From Database (=index): {Parameter} = {Platelets} under {test_type} = {Complete Blood Count} Result: Similar; Typo (spelling error and case difference)

        2. Alternative:
          * The options:
            > The parameter name uses a different but medically equivalent term (e.g., "AST" vs "SGOT")
            > OR: The parameter appears under a different but related test type (e.g., parameter "Total Cholesterol" under "Cholesterol Panel" instead of "Lipid Profile")
            > OR: Common abbreviations or full names= if the field is the most related to the index - only with alternative naming
            > Any case where either the parameter name OR its test type requires alternative medical terminology to match
          * Examples:
            > From file: {Parameter} =  {AST} under {test} = {Liver Panel} | From Database (=index): {Parameter} = {SGOT} under {test_type} = {Hepatic Function} Result: Alternative (different name for same enzyme, related test types)
            > From file: {Parameter} =  {HbA1c} under {test} = {Diabetic Profile} | From Database (=index): {Parameter} = {Hemoglobin A1c} under {test_type} = {Diabetes Panel} Result: Alternative (abbreviated parameter name and alternative test type naming)
            > From file: {Parameter} =  {Total Cholesterol} under {test} = {Cardiac Risk Assessment} | From Database (=index): {Parameter} = {Total Cholesterol} under {test_type} = {Lipid Profile} Result: Alternative (same parameter but under related alternative test type)
            > From file: {Parameter} =  {Neutrophils %} under {test} = {White Cell Count} | From Database (=index): {Parameter} = {Neutrophil Percentage} under {test_type} = {Complete Blood Count} Result: Alternative (similar parameter with slight naming difference, related test types)
            > From file: {Parameter} =  {Creatinine} under {test} = {Kidney Function} | From Database (=index): {Parameter} = {Serum Creatinine} under {test_type} = {Metabolic Panel} Result: Alternative (essentially same parameter with minor name difference, different but related test type)
            > From file: {Parameter} =  {LFTs} under {test} = {Hepatic Assessment} | From Database (=index): {Parameter} = {Liver Function Tests} under {test_type} = {Metabolic Panel} Result: Alternative (acronym vs full name, alternative test type naming)
            > From file: {Parameter} =  {Vitamin D 25-OH} under {test} = {Nutrition Panel} | From Database (=index): {Parameter} = {25-Hydroxyvitamin D} under {test_type} = {Vitamin Analysis} Result: Alternative (alternative naming for same compound, related test types)

        3. Unknown
          * The options:
            > The parameter has no equivalent in the index;
            > Any case where the parameter-test type combination cannot be reasonably matched to the index
          * Example:
            > From file: {Parameter} =  {Novel Biomarker XYZ} under {test} = {Cancer Screening} | From index: No equivalent parameter found Result: Unknown (parameter doesn't exist in index)
            > From file: {Parameter} =  {CA-125} under {test} = {Tumor Markers} | From index: No equivalent {parameter} or {test_type}  Result: Unknown (specialized test not in index)

        Additional information:
            - Please return the Unknown Parameters in the same format, without being Nested under Test; Sample.
            - Please analyse and return ALL the results in the report.
            - Please list everything in English.
            - Please do not make up information.
        `,
        },
        reason: {
          type: 'string',
          description:
            'Explanation for the match score, providing context about the matching decision.',
        },
      },
      required: ['match_score', 'reason'],
    },
  },
  required: ['match_info'],
};

// Helper function to validate data against schema
export function validateSchema(data: any, schema: any): boolean {
  try {
    // Basic validation - in production, you might want to use a library like ajv
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          console.warn(`Missing required field: ${field}`);
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Schema validation error:', error);
    return false;
  }
}

// Helper function to get schema description for prompts
export function getSchemaInstructions(schema: any): string {
  return `Please return a JSON object that matches this schema:\n${JSON.stringify(schema, null, 2)}`;
}
