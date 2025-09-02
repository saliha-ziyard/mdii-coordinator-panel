import { ExcelFormParser } from "./excel-form-parser"

// Kobo API client with fallback - no Excel files required
export const KOBO_CONFIG = {
  BASE_URL: "https://kf.kobotoolbox.org/api/v2",
  TOOL_ID_FIELD: "ID",
  MATURITY_FIELD: "tool_maturity",
  TOOL_NAME_FIELD: "tool_name",
  MAIN_FORM_ID: "aJn2DsjpAeJjrB6VazHjtz",
  USERTYPE3_FORMS: {
    advanced: "aFfhFi5vpsierwc3b5SNvc",
    early: "aCAhpbKYdsMbnGcWo4yR42",
  },
  USERTYPE4_FORMS: {
    advanced: "aU5LwrZps9u7Yt7obeShjv",
    early: "aKhnEosysRHsrUKxanCSKc",
  },
}

export interface QuestionLabel {
  name: string
  label: string
  type: string
  choices?: Array<{ name: string; label: string }>
}

export interface KoboFormData {
  userType: "usertype3" | "usertype4"
  maturityLevel: "advanced" | "early"
  data: any[]
  formId: string
  questions: QuestionLabel[]
  error?: string
}

export interface KoboApiResponse {
  results: any[]
  count: number
  next?: string
  previous?: string
}


export class KoboApiClient {
  private excelParser: ExcelFormParser;

  constructor() {
    this.excelParser = new ExcelFormParser();
  }

  async fetchData(formId: string): Promise<KoboApiResponse> {
    const proxyUrl = `/api/kobo?formId=${encodeURIComponent(formId)}`;
    console.log(`Client: Fetching data via proxy for form: ${formId}`);

    try {
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Client: SUCCESS! Found ${data.results.length} records for form ${formId}`);
      
      return data;
    } catch (error) {
      console.error(`Client: Error fetching data:`, error);
      throw error;
    }
  }

  async getToolMaturity(toolId: string): Promise<"advanced" | "early"> {
    console.log(`Client: Looking for tool ID: '${toolId}'`);
    
    try {
      const data = await this.fetchData(KOBO_CONFIG.MAIN_FORM_ID);
      console.log(`Client: Total records to search: ${data.results.length}`);

      for (let i = 0; i < data.results.length; i++) {
        const record = data.results[i];
        const recordId = String(record[KOBO_CONFIG.TOOL_ID_FIELD] || "").trim();
        
        if (recordId === String(toolId).trim()) {
          console.log(`Client: Found matching record at position ${i}!`);
          console.log(`Client: Tool name: ${record[KOBO_CONFIG.TOOL_NAME_FIELD] || 'N/A'}`);
          console.log(`Client: Maturity: ${record[KOBO_CONFIG.MATURITY_FIELD] || 'N/A'}`);
          
          const maturity = String(record[KOBO_CONFIG.MATURITY_FIELD] || "").toLowerCase().trim();
          
          if (maturity === "advanced" || maturity === "advance") {
            return "advanced";
          } else if (maturity === "early" || maturity === "early_stage") {
            return "early";
          } else {
            throw new Error(`Invalid maturity level: ${maturity}. Expected: advanced, advance, early, or early_stage`);
          }
        }
      }

      console.log("Client: No matching record found.");
      throw new Error(`Tool ID "${toolId}" not found in the main form`);
    } catch (error) {
      throw new Error(`Failed to fetch main form data: ${error instanceof Error ? error.message : error}`);
    }
  }

async getSurveyData(toolId: string, maturityLevel: "advanced" | "early"): Promise<KoboFormData[]> {
  const formsToFetch = [
    { 
      userType: "usertype3" as const, 
      formId: KOBO_CONFIG.USERTYPE3_FORMS[maturityLevel],
      formType: ExcelFormParser.getFormType("usertype3", maturityLevel)
    },
    { 
      userType: "usertype4" as const, 
      formId: KOBO_CONFIG.USERTYPE4_FORMS[maturityLevel],
      formType: ExcelFormParser.getFormType("usertype4", maturityLevel)
    },
  ];

  const fetchPromises = formsToFetch.map(async ({ userType, formId, formType }) => {
    try {
      console.log(`Client: Fetching ${userType} survey data for form type: ${formType}`);

      // Fetch survey data
      const data = await this.fetchData(formId);
      
      // Find matching records
      const matchingRecords = [];
      for (const record of data.results) {
        let recordToolId = "";
        
        if (record["group_toolid/Q_13110000"]) {
          recordToolId = String(record["group_toolid/Q_13110000"]).trim();
        } else if (record["group_requester/Q_13110000"]) {
          recordToolId = String(record["group_requester/Q_13110000"]).trim();
        } else if (record["group_individualinfo/Q_13110000"]) {
          recordToolId = String(record["group_individualinfo/Q_13110000"]).trim();
        } else if (record["Q_13110000"]) {
          recordToolId = String(record["Q_13110000"]).trim();
        }
        
        console.log(`Client: Survey ${userType} record ID: '${recordToolId}'`);
        if (recordToolId === String(toolId).trim()) {
          matchingRecords.push(record);
        }
      }
      
      console.log(`Client: Found ${matchingRecords.length} matching records for ${userType}`);

      // Fetch question labels from Excel file
      let questions: QuestionLabel[] = [];
      try {
        questions = await this.excelParser.getQuestionLabels(formType);
        // Normalize question names to remove group prefixes
        questions = questions.map(q => ({
          ...q,
          name: q.name.split('/').pop() || q.name // Remove group prefix (e.g., 'group_toolid/Q_13110000' -> 'Q_13110000')
        }));
        console.log(`Client: Loaded ${questions.length} question labels from Excel for ${formType}`);
      } catch (excelError) {
        console.error(`Client: Failed to load Excel schema for ${formType}:`, excelError);
        return {
          userType,
          maturityLevel,
          data: matchingRecords,
          formId,
          questions: [],
          error: `Failed to load question labels from Excel: ${excelError instanceof Error ? excelError.message : excelError}`
        };
      }

      // Normalize data field names to remove group prefixes
      const normalizedData = matchingRecords.map(record => {
        const normalizedRecord: any = {};
        Object.keys(record).forEach(key => {
          const normalizedKey = key.split('/').pop() || key;
          normalizedRecord[normalizedKey] = record[key];
        });
        return normalizedRecord;
      });

      return {
        userType,
        maturityLevel,
        data: normalizedData,
        formId,
        questions
      };
    } catch (err) {
      console.warn(`Client: Could not fetch ${userType} survey data:`, err);
      return {
        userType,
        maturityLevel,
        data: [],
        formId,
        questions: [],
        error: err instanceof Error ? err.message : "Unknown error"
      };
    }
  });

  return Promise.all(fetchPromises);
}
  async getAllFormData(maturityLevel: "advanced" | "early", toolId: string): Promise<KoboFormData[]> {
    return this.getSurveyData(toolId, maturityLevel);
  }
}