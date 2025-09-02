// Excel Form Schema Parser for KoboToolbox XLSForm files
import * as XLSX from 'xlsx'

export interface QuestionMapping {
  name: string // Field name like "Q_13110000"
  label: string // Human readable question
  type: string // Field type
  choices?: Array<{ name: string; label: string }> // For select questions
  listName?: string // Reference to choices list
}

export interface FormQuestions {
  survey: QuestionMapping[]
  choices: { [listName: string]: Array<{ name: string; label: string }> }
}

export class ExcelFormParser {
  private formCache: Map<string, FormQuestions> = new Map()

  /**
   * Load and parse an XLSForm file from the assets folder
   */
 async loadFormSchema(formType: 'ut3_early' | 'ut3_advance' | 'ut4_early' | 'ut4_advance'): Promise<FormQuestions> {
  // Check cache first
  if (this.formCache.has(formType)) {
    return this.formCache.get(formType)!;
  }

  try {
    // Load the Excel file
    const filePath = `/${formType}.xlsx`;
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Could not load form schema file: ${filePath}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Parse the survey sheet
    const surveySheet = workbook.Sheets['survey'];
    if (!surveySheet) {
      throw new Error('No "survey" sheet found in the Excel file');
    }

    const surveyData = XLSX.utils.sheet_to_json(surveySheet) as any[];
    const survey: QuestionMapping[] = [];

    for (const row of surveyData) {
      // Map column B (question code) and column C (question label)
      const mapping: QuestionMapping = {
        name: row.name || row.code || '', // Column B, typically 'name' in XLSForm
        label: this.extractEnglishLabel(row['label::English (en)'] || row.question || row.label || row.name || ''), // Column C, try multiple possible headers
        type: row.type || 'text'
      };

      // Add choices reference if it exists
      if (row.list_name || row.choices) {
        mapping.listName = row.list_name || row.choices;
      }

      survey.push(mapping);
    }

    // Parse the choices sheet if it exists
    const choices: { [listName: string]: Array<{ name: string; label: string }> } = {};
    const choicesSheet = workbook.Sheets['choices'];
    
    if (choicesSheet) {
      const choicesData = XLSX.utils.sheet_to_json(choicesSheet) as any[];
      
      for (const row of choicesData) {
        const listName = row.list_name || row['list name'];
        if (!listName) continue;

        if (!choices[listName]) {
          choices[listName] = [];
        }

        choices[listName].push({
          name: row.name || '',
          label: this.extractEnglishLabel(row['label::English (en)'] || row.label || row.name || '')
        });
      }
    }

    // Add choices to survey questions
    survey.forEach(question => {
      if (question.listName && choices[question.listName]) {
        question.choices = choices[question.listName];
      }
    });

    const result: FormQuestions = { survey, choices };
    
    // Cache the result
    this.formCache.set(formType, result);
    
    return result;
  } catch (error) {
    console.error(`Error loading form schema for ${formType}:`, error);
    throw error;
  }
}

  /**
   * Get question label by field name
   */
  async getQuestionLabel(formType: 'ut3_early' | 'ut3_advance' | 'ut4_early' | 'ut4_advance', fieldName: string): Promise<string> {
    const schema = await this.loadFormSchema(formType)
    const question = schema.survey.find(q => q.name === fieldName)
    return question ? question.label : fieldName
  }

  /**
   * Get all questions for a form type
   */
  async getAllQuestions(formType: 'ut3_early' | 'ut3_advance' | 'ut4_early' | 'ut4_advance'): Promise<QuestionMapping[]> {
    const schema = await this.loadFormSchema(formType)
    return schema.survey
  }

  /**
   * Get choice label for a select question
   */
  async getChoiceLabel(formType: 'ut3_early' | 'ut3_advance' | 'ut4_early' | 'ut4_advance', fieldName: string, choiceValue: string): Promise<string> {
    const schema = await this.loadFormSchema(formType)
    const question = schema.survey.find(q => q.name === fieldName)
    
    if (question && question.choices) {
      const choice = question.choices.find(c => c.name === choiceValue)
      return choice ? choice.label : choiceValue
    }
    
    return choiceValue
  }

  /**
   * Create question labels array compatible with existing DataTable component
   */
  async getQuestionLabels(formType: 'ut3_early' | 'ut3_advance' | 'ut4_early' | 'ut4_advance'): Promise<QuestionLabel[]> {
    const schema = await this.loadFormSchema(formType)
    
    return schema.survey.map(q => ({
      name: q.name,
      label: q.label,
      type: q.type,
      choices: q.choices
    }))
  }

  /**
   * Extract English label, handling various formats
   */
  private extractEnglishLabel(label: string): string {
    if (!label) return ''
    
    // Handle HTML-style formatting
    label = label.replace(/<[^>]*>/g, '') // Remove HTML tags
    label = label.replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
    label = label.trim()
    
    return label
  }

  /**
   * Determine form type from user type and maturity level
   */
  static getFormType(userType: 'usertype3' | 'usertype4', maturityLevel: 'advanced' | 'early'): 'ut3_early' | 'ut3_advance' | 'ut4_early' | 'ut4_advance' {
    if (userType === 'usertype3') {
      return maturityLevel === 'advanced' ? 'ut3_advance' : 'ut3_early'
    } else {
      return maturityLevel === 'advanced' ? 'ut4_advance' : 'ut4_early'
    }
  }

  /**
   * Clear cache (useful for testing or when forms are updated)
   */
  clearCache(): void {
    this.formCache.clear()
  }
}

// Import this interface in your existing code
export interface QuestionLabel {
  name: string
  label: string
  type: string
  choices?: Array<{ name: string; label: string }>
}