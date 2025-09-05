import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { LLMClient } from './LLMClient.js';
import { IntentMappingService } from './IntentMappingService.js';
import { PostgreSQLSchemaFileParser } from './PostgreSQLSchemaFileParser.js';
import { MongoDBSchemaFileParser } from './MongoDBSchemaFileParser.js';
import { MigrationAnalysisFileParser } from './MigrationAnalysisFileParser.js';
import { MongoDBDocumentationService } from './MongoDBDocumentationService.js';
import { UnifiedKnowledgeService } from './UnifiedKnowledgeService.js';

export interface AnalysisContext {
  postgresSchema?: any;
  mongodbSchema?: any;
  migrationAnalysis?: any;
  mongodbDocumentation?: any;
  latestFiles: {
    postgres?: string;
    mongodb?: string;
    migration?: string;
  };
}

export interface RationaleResponse {
  answer: string;
  context: {
    sourceFiles: string[];
    analysisType: 'postgres' | 'mongodb' | 'migration' | 'comparison';
  };
}

export class RationaleConversationService {
  private llmClient: LLMClient;
  private intentMappingService: IntentMappingService;
  private postgresParser: PostgreSQLSchemaFileParser;
  private mongodbParser: MongoDBSchemaFileParser;
  private migrationParser: MigrationAnalysisFileParser;
  private mongodbDocsService: MongoDBDocumentationService;
  private unifiedKnowledgeService: UnifiedKnowledgeService;

  constructor() {
    this.llmClient = LLMClient.getInstance();
    this.intentMappingService = IntentMappingService.getInstance();
    this.postgresParser = new PostgreSQLSchemaFileParser();
    this.mongodbParser = new MongoDBSchemaFileParser();
    this.migrationParser = new MigrationAnalysisFileParser();
    this.mongodbDocsService = MongoDBDocumentationService.getInstance();
    this.unifiedKnowledgeService = UnifiedKnowledgeService.getInstance();
  }

  /**
   * Handle comprehensive queries using unified knowledge service
   */
  async handleComprehensiveQuery(userQuery: string, projectPath: string = process.cwd()): Promise<any> {
    try {
      console.log(chalk.blue(`🧠 Processing comprehensive query: "${userQuery}"`));
      
      // Use the unified knowledge service for comprehensive answers
      const unifiedResponse = await this.unifiedKnowledgeService.processQuery(userQuery, projectPath);
      
      // Format response for consistency with existing interface
      const response: RationaleResponse = {
        answer: unifiedResponse.answer,
        context: {
          sourceFiles: this.getSourceFilesFromResponse(unifiedResponse),
          analysisType: this.determineAnalysisTypeFromSources(unifiedResponse.sources)
        }
      };
      
      // Add compliance information if available
      if (unifiedResponse.compliance) {
        response.answer += `\n\n📊 **Compliance Analysis:**\n`;
        if (unifiedResponse.compliance.isCompliant) {
          response.answer += `✅ **Compliant** - Follows MongoDB best practices\n`;
        } else {
          response.answer += `⚠️ **Needs Review** - ${unifiedResponse.compliance.warnings.length} warning(s)\n`;
        }
        
        if (unifiedResponse.compliance.recommendations.length > 0) {
          response.answer += `\n💡 **Recommendations:**\n`;
          unifiedResponse.compliance.recommendations.forEach(rec => {
            response.answer += `• ${rec}\n`;
          });
        }
      }
      
      // Add confidence and reasoning
      response.answer += `\n\n🎯 **Response Confidence:** ${Math.round(unifiedResponse.confidence * 100)}%\n`;
      response.answer += `📚 **Knowledge Sources:** ${Object.entries(unifiedResponse.sources).filter(([_, used]) => used).map(([source, _]) => source).join(', ')}\n`;
      response.answer += `🧠 **Reasoning:** ${unifiedResponse.reasoning}\n`;
      
      return response;
      
    } catch (error) {
      console.error('❌ Comprehensive query processing failed:', error);
      return {
        answer: 'I apologize, but I encountered an error while processing your comprehensive query. Please try again.',
        context: {
          sourceFiles: [],
          analysisType: 'comparison'
        }
      };
    }
  }

  /**
   * Main method to handle rationale conversation queries
   */
  async handleRationaleQuery(userQuery: string, projectPath: string = process.cwd()): Promise<RationaleResponse> {
    try {
      // 1. Detect available analysis files
      const context = await this.detectAnalysisContext(projectPath);
      
      // 2. Check if we have the necessary files
      if (!(await this.hasRequiredFiles(context, userQuery))) {
        return this.generateMissingFilesResponse(context, userQuery);
      }

      // 3. Parse relevant files based on query intent
      const parsedData = await this.parseRelevantFiles(context, userQuery);

      // 4. Generate rationale response using LLM
      const response = await this.generateRationaleResponse(userQuery, parsedData, context);

      return response;
    } catch (error) {
      console.error('Error in rationale conversation:', error);
      return {
        answer: `I encountered an error while processing your question: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or check if the required analysis files are available.`,
        context: {
          sourceFiles: [],
          analysisType: 'comparison'
        }
      };
    }
  }

  /**
   * Detect available analysis files in the project directory
   */
  private async detectAnalysisContext(projectPath: string): Promise<AnalysisContext> {
    // Use the proper parsers to find latest files
    const postgresFile = this.postgresParser.findLatestPostgreSQLSchemaFile();
    const mongodbFile = this.mongodbParser.findLatestMongoDBSchemaFile(projectPath);
    const migrationFile = this.migrationParser.findLatestMigrationAnalysisFile(projectPath);

    return {
      latestFiles: {
        postgres: postgresFile || undefined,
        mongodb: mongodbFile || undefined,
        migration: migrationFile || undefined
      }
    };
  }

  /**
   * Check if we have the required files for the query
   */
  private async hasRequiredFiles(context: AnalysisContext, query: string): Promise<boolean> {
    const queryLower = query.toLowerCase();
    
    // For rationale questions, we need at least one schema file
    if (await this.isRationaleQuery(queryLower)) {
      return !!(context.latestFiles.postgres || context.latestFiles.mongodb);
    }
    
    // Check for PostgreSQL-related queries
    if (this.isPostgresQuery(queryLower)) {
      return !!context.latestFiles.postgres;
    }
    
    // Check for MongoDB-related queries
    if (this.isMongoDBQuery(queryLower)) {
      return !!context.latestFiles.mongodb;
    }
    
    // Check for migration/comparison queries
    if (this.isMigrationQuery(queryLower)) {
      return !!(context.latestFiles.postgres && context.latestFiles.mongodb);
    }
    
    // Default: need at least one schema file
    return !!(context.latestFiles.postgres || context.latestFiles.mongodb);
  }

  /**
   * Generate response when required files are missing
   */
  private generateMissingFilesResponse(context: AnalysisContext, query: string): RationaleResponse {
    const missingFiles = [];
    
    if (this.isPostgresQuery(query.toLowerCase()) && !context.latestFiles.postgres) {
      missingFiles.push('PostgreSQL schema analysis');
    }
    
    if (this.isMongoDBQuery(query.toLowerCase()) && !context.latestFiles.mongodb) {
      missingFiles.push('MongoDB schema analysis');
    }
    
    if (this.isMigrationQuery(query.toLowerCase())) {
      if (!context.latestFiles.postgres) missingFiles.push('PostgreSQL schema analysis');
      if (!context.latestFiles.mongodb) missingFiles.push('MongoDB schema analysis');
    }

    const answer = `I'd love to help you with that question! However, I need the following analysis files to be generated first:

${missingFiles.map(file => `• ${file}`).join('\n')}

**To generate these files, please run:**
${this.getRequiredCommands(missingFiles)}

**What I can do once you have these files:**
• Answer detailed questions about your database schema
• Explain the rationale behind migration decisions
• Provide insights about table relationships and transformations
• Help you understand the business logic behind design choices
• Compare PostgreSQL and MongoDB schemas
• Explain embedding and grouping strategies

**Example questions I can answer:**
• "Why was the user table structured this way in MongoDB?"
• "What's the relationship between orders and customers?"
• "How many fields does the products table have?"
• "Why did you choose to embed the address data?"
• "What's the migration strategy for this database?"

Just run the commands above, and then ask me anything about your database! 🚀`;

    return {
      answer,
      context: {
        sourceFiles: [],
        analysisType: 'comparison'
      }
    };
  }

  /**
   * Parse relevant files based on the query intent
   */
  private async parseRelevantFiles(context: AnalysisContext, query: string): Promise<any> {
    const parsedData: any = {};
    const queryLower = query.toLowerCase();

    // For rationale queries, parse all available files to provide comprehensive context
    if (await this.isRationaleQuery(queryLower)) {
      if (context.latestFiles.postgres) {
        try {
          parsedData.postgres = await this.postgresParser.parsePostgreSQLSchemaFile(context.latestFiles.postgres);
        } catch (error) {
          console.warn('Failed to parse PostgreSQL schema file:', error);
          parsedData.postgres = await this.parseMarkdownFile(context.latestFiles.postgres);
        }
      }
      
      if (context.latestFiles.mongodb) {
        try {
          parsedData.mongodb = await this.mongodbParser.parseSchemaFile(context.latestFiles.mongodb);
        } catch (error) {
          console.warn('Failed to parse MongoDB schema file:', error);
          parsedData.mongodb = await this.parseMarkdownFile(context.latestFiles.mongodb);
        }
      }
      
      if (context.latestFiles.migration) {
        try {
          parsedData.migration = await this.migrationParser.parseAnalysisFile(context.latestFiles.migration);
        } catch (error) {
          console.warn('Failed to parse migration analysis file:', error);
          parsedData.migration = await this.parseMarkdownFile(context.latestFiles.migration);
        }
      }

      // NEW: Add MongoDB Documentation for rationale queries
      if (this.needsMongoDBDocumentation(queryLower)) {
        try {
          parsedData.mongodbDocs = await this.mongodbDocsService.getRelevantDocumentation(query);
        } catch (error) {
          console.warn('Failed to fetch MongoDB documentation:', error);
        }
      }
    } else {
      // For specific queries, parse only relevant files
      if (this.isPostgresQuery(queryLower) && context.latestFiles.postgres) {
        try {
          parsedData.postgres = await this.postgresParser.parsePostgreSQLSchemaFile(context.latestFiles.postgres);
        } catch (error) {
          console.warn('Failed to parse PostgreSQL schema file:', error);
          parsedData.postgres = await this.parseMarkdownFile(context.latestFiles.postgres);
        }
      }

      if (this.isMongoDBQuery(queryLower) && context.latestFiles.mongodb) {
        try {
          parsedData.mongodb = await this.mongodbParser.parseSchemaFile(context.latestFiles.mongodb);
        } catch (error) {
          console.warn('Failed to parse MongoDB schema file:', error);
          parsedData.mongodb = await this.parseMarkdownFile(context.latestFiles.mongodb);
        }
      }

      if (this.isMigrationQuery(queryLower) && context.latestFiles.migration) {
        try {
          parsedData.migration = await this.migrationParser.parseAnalysisFile(context.latestFiles.migration);
        } catch (error) {
          console.warn('Failed to parse migration analysis file:', error);
          parsedData.migration = await this.parseMarkdownFile(context.latestFiles.migration);
        }
      }

      // NEW: Add MongoDB Documentation for specific MongoDB queries
      if (this.needsMongoDBDocumentation(queryLower)) {
        try {
          parsedData.mongodbDocs = await this.mongodbDocsService.getRelevantDocumentation(query);
        } catch (error) {
          console.warn('Failed to fetch MongoDB documentation:', error);
        }
      }
    }

    return parsedData;
  }

  /**
   * Generate rationale response using LLM
   */
  private async generateRationaleResponse(
    query: string, 
    parsedData: any, 
    context: AnalysisContext
  ): Promise<RationaleResponse> {
    const systemPrompt = this.buildSystemPrompt(parsedData, context, query);
    const queryType = this.determineQueryType(query);
    
    const userPrompt = `User Question: ${query}

RESPONSE REQUIREMENTS:
• Provide concise, direct answers (70-80 words maximum)
• Use simple, human-readable language
• Reference ONLY actual schema data from above
• Include specific examples from the actual database
• NO markdown formatting, bullet points, or technical jargon
• NO generic examples - use only data from the actual schema

QUERY TYPE: ${queryType}

Answer the user's question using the actual schema data provided above. Be direct and conversational.`;

    const response = await this.llmClient.generateTextResponse(systemPrompt, userPrompt);
    
    const sourceFiles = Object.values(context.latestFiles).filter(Boolean) as string[];
    const analysisType = this.determineAnalysisType(query, context);

    return {
      answer: response,
      context: {
        sourceFiles,
        analysisType
      }
    };
  }

  /**
   * Build system prompt with relevant context
   */
  private buildSystemPrompt(parsedData: any, context: AnalysisContext, query?: string): string {
    let prompt = `You are an expert database architect and migration specialist. Provide detailed, specific answers based on the actual database schema data below.

ACTUAL SCHEMA DATA:
`;

    if (parsedData.postgres) {
      prompt += `
PostgreSQL Schema Data:
${this.formatStructuredPostgresData(parsedData.postgres, query)}

PostgreSQL Relationships:
${this.formatStructuredRelationships(parsedData.postgres.relationships || [])}

PostgreSQL Summary:
${this.formatPostgresSummary(parsedData.postgres.summary || {})}
`;
    }

    if (parsedData.mongodb) {
      prompt += `
MongoDB Schema Data:
${this.formatStructuredMongoDBData(parsedData.mongodb)}

MongoDB Relationships:
${this.formatStructuredMongoDBRelationships(parsedData.mongodb.relationships || [])}

MongoDB Summary:
${this.formatMongoDBSummary(parsedData.mongodb.summary || {})}
`;
    }

    if (parsedData.migration) {
      prompt += `
Migration Analysis Data:
${this.formatStructuredMigrationData(parsedData.migration)}

Migration Transformations:
${this.formatStructuredTransformations(parsedData.migration.transformationRules || [])}

Migration Recommendations:
${this.formatStructuredRecommendations(parsedData.migration.recommendations || [])}
`;
    }

    // NEW: Add MongoDB Documentation
    if (parsedData.mongodbDocs) {
      prompt += `
MongoDB Official Documentation:
${parsedData.mongodbDocs}
`;
    }

    prompt += `

RESPONSE RULES:
• Use ONLY actual table/collection names from the data above
• Reference specific fields, relationships, and transformations from the actual data
• Provide detailed explanations with concrete examples from this specific schema
• Use bullet points (•) or numbers (1. 2. 3.) for clarity
• Be specific to this database schema and migration context
• Include technical details and business rationale
• Reference actual field types, constraints, and relationships
• Explain the reasoning behind specific design decisions
• When referencing MongoDB best practices, cite the official documentation
• Combine your specific schema data with MongoDB official recommendations
• NO generic examples - use only data from the actual schema and official MongoDB docs`;

    return prompt;
  }

  /**
   * Helper methods to determine query intent using LLM for dynamic detection
   */
  private async isRationaleQuery(query: string): Promise<boolean> {
    try {
      const llmClient = LLMClient.getInstance();
      const systemPrompt = `You are an expert at analyzing database-related queries. Determine if this query requires database analysis context to answer properly.

A query needs database context if it asks about:
- Database structure (tables, collections, fields, relationships)
- Data migration or transformation
- Schema analysis or comparison
- Performance or optimization
- Data relationships or constraints
- Counts or statistics about the database
- Specific database entities or their properties

Respond with just "true" or "false".`;

      const response = await llmClient.generateTextResponse(systemPrompt, `Query: "${query}"`);

      return response.trim().toLowerCase() === 'true';
    } catch (error) {
      console.warn('Failed to analyze query with LLM, using fallback:', error);
      return this.fallbackRationaleDetection(query);
    }
  }

  /**
   * Fallback rationale detection when LLM fails
   */
  private fallbackRationaleDetection(query: string): boolean {
    const rationaleKeywords = [
      'why', 'rationale', 'reason', 'explain', 'justify', 'decision', 'thinking', 'logic', 
      'how', 'what', 'when', 'where', 'which', 'who', 'show', 'tell', 'describe',
      'count', 'number', 'total', 'list', 'find', 'search', 'look', 'see',
      'relationship', 'connection', 'link', 'between', 'among', 'across',
      'field', 'column', 'table', 'collection', 'document', 'schema',
      'migration', 'transform', 'convert', 'change', 'strategy', 'approach',
      'embed', 'group', 'combine', 'merge', 'split', 'separate'
    ];
    return rationaleKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private isPostgresQuery(query: string): boolean {
    const postgresKeywords = ['postgres', 'postgresql', 'table', 'column', 'relation', 'sql'];
    return postgresKeywords.some(keyword => query.includes(keyword));
  }

  private isMongoDBQuery(query: string): boolean {
    const mongodbKeywords = ['mongo', 'mongodb', 'collection', 'document', 'embed', 'nosql'];
    return mongodbKeywords.some(keyword => query.includes(keyword));
  }

  private isMigrationQuery(query: string): boolean {
    const migrationKeywords = ['migrate', 'transform', 'convert', 'embed', 'group'];
    return migrationKeywords.some(keyword => query.includes(keyword));
  }

  /**
   * Determine if MongoDB documentation is needed for the query
   */
  private needsMongoDBDocumentation(query: string): boolean {
    const mongodbDocsKeywords = [
      'mongodb', 'mongo', 'collection', 'document', 'bson', 'nosql',
      'atlas', 'compass', 'aggregation', 'pipeline', 'index', 'performance',
      'transaction', 'acid', 'consistency', 'best practice', 'recommendation',
      'official', 'documentation', 'guide', 'tutorial', 'example',
      'vector search', 'search', 'full text', 'embedded', 'referenced',
      'data modeling', 'schema design', 'relationships', 'optimization'
    ];
    
    const queryLower = query.toLowerCase();
    return mongodbDocsKeywords.some(keyword => queryLower.includes(keyword)) ||
           queryLower.includes('how to') ||
           queryLower.includes('what is') ||
           queryLower.includes('best way') ||
           queryLower.includes('recommended');
  }

  /**
   * Get source files from unified response
   */
  private getSourceFilesFromResponse(unifiedResponse: any): string[] {
    const sourceFiles: string[] = [];
    
    if (unifiedResponse.sources.postgres) sourceFiles.push('PostgreSQL Schema');
    if (unifiedResponse.sources.mongodb) sourceFiles.push('MongoDB Schema');
    if (unifiedResponse.sources.migration) sourceFiles.push('Migration Analysis');
    if (unifiedResponse.sources.mongodbDocs) sourceFiles.push('MongoDB Documentation');
    
    return sourceFiles;
  }

  /**
   * Determine analysis type from sources used
   */
  private determineAnalysisTypeFromSources(sources: any): 'postgres' | 'mongodb' | 'migration' | 'comparison' {
    if (sources.migration) return 'migration';
    if (sources.postgres && sources.mongodb) return 'comparison';
    if (sources.mongodb) return 'mongodb';
    if (sources.postgres) return 'postgres';
    return 'comparison';
  }

  private determineAnalysisType(query: string, context: AnalysisContext): 'postgres' | 'mongodb' | 'migration' | 'comparison' {
    if (this.isMigrationQuery(query.toLowerCase())) return 'migration';
    if (this.isPostgresQuery(query.toLowerCase())) return 'postgres';
    if (this.isMongoDBQuery(query.toLowerCase())) return 'mongodb';
    return 'comparison';
  }

  /**
   * Determine the specific type of rationale query for better context
   */
  private determineQueryType(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('embed') || queryLower.includes('embedded')) {
      return 'EMBEDDING_RATIONALE - Why fields were embedded in documents';
    }
    
    if (queryLower.includes('group') || queryLower.includes('together') || queryLower.includes('combine')) {
      return 'GROUPING_RATIONALE - Why tables/collections were grouped together';
    }
    
    if (queryLower.includes('transform') || queryLower.includes('convert') || queryLower.includes('change')) {
      return 'TRANSFORMATION_RATIONALE - Why schema transformations were chosen';
    }
    
    if (queryLower.includes('migration') || queryLower.includes('approach') || queryLower.includes('strategy')) {
      return 'MIGRATION_RATIONALE - Why migration approach was chosen';
    }
    
    if (queryLower.includes('decision') || queryLower.includes('design')) {
      return 'DESIGN_DECISION_RATIONALE - Why specific design decisions were made';
    }
    
    return 'GENERAL_RATIONALE - General reasoning behind schema choices';
  }

  private getRequiredCommands(missingFiles: string[]): string {
    const commands = [];
    
    if (missingFiles.some(file => file.includes('PostgreSQL'))) {
      commands.push('npm run dev -- analyze postgres');
    }
    
    if (missingFiles.some(file => file.includes('MongoDB'))) {
      commands.push('npm run dev -- analyze mongo');
    }
    
    return commands.join('\n');
  }

  /**
   * Format PostgreSQL tables for prompt
   */
  private formatPostgresTables(tables: any[]): string {
    if (!tables || tables.length === 0) return 'No tables found';
    
    return tables.map(table => 
      `- ${table.name}: ${table.columns?.length || 0} columns`
    ).join('\n');
  }

  /**
   * Format PostgreSQL relationships for prompt
   */
  private formatPostgresRelationships(relationships: any[]): string {
    if (!relationships || relationships.length === 0) return 'No relationships found';
    
    return relationships.map(rel => 
      `- ${rel.fromTable} → ${rel.toTable} (${rel.type})`
    ).join('\n');
  }

  /**
   * Format MongoDB collections for prompt
   */
  private formatMongoDBCollections(collections: any[]): string {
    if (!collections || collections.length === 0) return 'No collections found';
    
    return collections.map(collection => 
      `- ${collection.name}: ${collection.documents?.length || 0} document types`
    ).join('\n');
  }

  /**
   * Format migration transformations for prompt
   */
  private formatMigrationTransformations(transformations: any[]): string {
    if (!transformations || transformations.length === 0) return 'No transformations found';
    
    return transformations.map(trans => 
      `- ${trans.sourceType} → ${trans.targetType}: ${trans.description}`
    ).join('\n');
  }

  /**
   * Format extracted tables for prompt
   */
  private formatExtractedTables(tables: any[]): string {
    if (!tables || tables.length === 0) return 'No tables/collections found';
    
    return tables.map(table => {
      const fields = table.fields?.map((f: any) => f.name).join(', ') || 'no fields';
      return `- ${table.name} (${table.type}): ${fields}`;
    }).join('\n');
  }

  /**
   * Format extracted relationships for prompt
   */
  private formatExtractedRelationships(relationships: any[]): string {
    if (!relationships || relationships.length === 0) return 'No relationships found';
    
    return relationships.map(rel => {
      if (rel.type === 'foreign_key') {
        return `- ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField}`;
      } else if (rel.type === 'embedded') {
        return `- ${rel.fromTable} → embedded in ${rel.toTable}`;
      }
      return `- ${rel.fromTable} → ${rel.toTable}`;
    }).join('\n');
  }

  /**
   * Format extracted transformations for prompt
   */
  private formatExtractedTransformations(transformations: any[]): string {
    if (!transformations || transformations.length === 0) return 'No transformations found';
    
    return transformations.map(trans => 
      `- ${trans.sourceName} (${trans.sourceType}) → ${trans.targetName} (${trans.targetType})`
    ).join('\n');
  }

  /**
   * Format structured PostgreSQL data for prompt
   */
  private formatStructuredPostgresData(postgresData: any, query?: string): string {
    if (!postgresData || !postgresData.tables) return 'No PostgreSQL data available';
    
    let result = `Tables (${postgresData.tables.length}):\n`;
    
    // If query mentions a specific table, prioritize it
    let tablesToShow = postgresData.tables;
    if (query) {
      const queryLower = query.toLowerCase();
      const matchingTable = postgresData.tables.find((table: any) => 
        queryLower.includes(table.name.toLowerCase())
      );
      if (matchingTable) {
        // Show the matching table first, then others
        tablesToShow = [matchingTable, ...postgresData.tables.filter((t: any) => t.name !== matchingTable.name)];
      }
    }
    
    // Show all tables, but prioritize the queried table if mentioned
    tablesToShow.forEach((table: any) => {
      result += `• ${table.name}:\n`;
      if (table.columns) {
        table.columns.forEach((col: any) => {
          result += `  - ${col.name}: ${col.type} ${col.nullable ? '(nullable)' : '(not null)'} ${col.isPrimary ? '[PRIMARY KEY]' : ''}\n`;
        });
      }
      if (table.foreignKeys && table.foreignKeys.length > 0) {
        result += `  Foreign Keys: ${table.foreignKeys.map((fk: any) => `${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}`).join(', ')}\n`;
      }
    });
    
    if (postgresData.views && postgresData.views.length > 0) {
      result += `\nViews (${postgresData.views.length}):\n`;
      postgresData.views.forEach((view: any) => {
        result += `• ${view.name}\n`;
      });
    }
    
    if (postgresData.functions && postgresData.functions.length > 0) {
      result += `\nFunctions (${postgresData.functions.length}):\n`;
      postgresData.functions.forEach((func: any) => {
        result += `• ${func.name}() → ${func.returnType}\n`;
      });
    }
    
    return result;
  }

  /**
   * Format structured MongoDB data for prompt
   */
  private formatStructuredMongoDBData(mongodbData: any): string {
    if (!mongodbData || !mongodbData.collections) return 'No MongoDB data available';
    
    let result = `Collections (${mongodbData.collections.length}):\n`;
    mongodbData.collections.forEach((collection: any) => {
      result += `• ${collection.name}:\n`;
      if (collection.documents) {
        collection.documents.forEach((doc: any) => {
          result += `  - ${doc.name} Document:\n`;
          if (doc.fields) {
            doc.fields.forEach((field: any) => {
              result += `    - ${field.name}: ${field.type} ${field.required ? '(required)' : '(optional)'}\n`;
            });
          }
        });
      }
    });
    
    if (mongodbData.embeddedDocuments && mongodbData.embeddedDocuments.length > 0) {
      result += `\nEmbedded Documents (${mongodbData.embeddedDocuments.length}):\n`;
      mongodbData.embeddedDocuments.forEach((embedded: any) => {
        result += `• ${embedded.documentName} (in ${embedded.parentCollection})\n`;
      });
    }
    
    return result;
  }

  /**
   * Format structured migration data for prompt
   */
  private formatStructuredMigrationData(migrationData: any): string {
    if (!migrationData) return 'No migration data available';
    
    let result = '';
    
    if (migrationData.transformationRules && migrationData.transformationRules.length > 0) {
      result += `Transformation Rules (${migrationData.transformationRules.length}):\n`;
      migrationData.transformationRules.forEach((rule: any) => {
        result += `• ${rule.sourceType} → ${rule.targetType}: ${rule.description}\n`;
        if (rule.rationale) {
          result += `  Rationale: ${rule.rationale}\n`;
        }
      });
    }
    
    if (migrationData.dataMapping && migrationData.dataMapping.length > 0) {
      result += `\nData Mappings (${migrationData.dataMapping.length}):\n`;
      migrationData.dataMapping.forEach((mapping: any) => {
        result += `• ${mapping.sourceField} → ${mapping.targetField}: ${mapping.transformation}\n`;
      });
    }
    
    return result;
  }

  /**
   * Format structured relationships for prompt
   */
  private formatStructuredRelationships(relationships: any[]): string {
    if (!relationships || relationships.length === 0) return 'No relationships found';
    
    return relationships.map(rel => {
      if (rel.type === 'foreign_key') {
        return `• ${rel.fromTable}.${rel.fromField} → ${rel.toTable}.${rel.toField} (FK)`;
      } else if (rel.type === 'embedded') {
        return `• ${rel.fromTable} → embedded in ${rel.toTable}`;
      }
      return `• ${rel.fromTable} → ${rel.toTable} (${rel.type})`;
    }).join('\n');
  }

  /**
   * Format structured MongoDB relationships for prompt
   */
  private formatStructuredMongoDBRelationships(relationships: any[]): string {
    if (!relationships || relationships.length === 0) return 'No relationships found';
    
    return relationships.map(rel => 
      `• ${rel.from} → ${rel.to} (${rel.type})`
    ).join('\n');
  }

  /**
   * Format structured transformations for prompt
   */
  private formatStructuredTransformations(transformations: any[]): string {
    if (!transformations || transformations.length === 0) return 'No transformations found';
    
    return transformations.map(trans => 
      `• ${trans.sourceType} → ${trans.targetType}: ${trans.description}`
    ).join('\n');
  }

  /**
   * Format structured recommendations for prompt
   */
  private formatStructuredRecommendations(recommendations: any[]): string {
    if (!recommendations || recommendations.length === 0) return 'No recommendations found';
    
    return recommendations.map(rec => 
      `• [${rec.priority.toUpperCase()}] ${rec.title}: ${rec.description}`
    ).join('\n');
  }

  /**
   * Format PostgreSQL summary for prompt
   */
  private formatPostgresSummary(summary: any): string {
    if (!summary) return 'No summary available';
    
    return `Total Tables: ${summary.totalTables || 0}, Views: ${summary.totalViews || 0}, Functions: ${summary.totalFunctions || 0}, Triggers: ${summary.totalTriggers || 0}`;
  }

  /**
   * Format MongoDB summary for prompt
   */
  private formatMongoDBSummary(summary: any): string {
    if (!summary) return 'No summary available';
    
    return `Total Collections: ${summary.totalCollections || 0}, Documents: ${summary.totalDocuments || 0}, Indexes: ${summary.totalIndexes || 0}`;
  }

  /**
   * Parse markdown file and extract schema data
   */
  private async parseMarkdownFile(filePath: string): Promise<any> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract tables/collections from markdown
      const tables = this.extractTablesFromMarkdown(content);
      const relationships = this.extractRelationshipsFromMarkdown(content);
      const transformations = this.extractTransformationsFromMarkdown(content);
      
      return {
        tables,
        relationships,
        transformations,
        rawContent: content.substring(0, 2000) // First 2000 chars for context
      };
    } catch (error) {
      console.error('Error parsing markdown file:', error);
      return { tables: [], relationships: [], transformations: [], rawContent: '' };
    }
  }

  /**
   * Extract table/collection information from markdown content
   */
  private extractTablesFromMarkdown(content: string): any[] {
    const tables: any[] = [];
    
    // Extract PostgreSQL tables - get unique table names first
    const tableNameRegex = /### Table: `([^`]+)`/g;
    const uniqueTableNames = new Set<string>();
    let match;
    
    while ((match = tableNameRegex.exec(content)) !== null) {
      uniqueTableNames.add(match[1]);
    }
    
    // For each unique table, extract its fields
    for (const tableName of uniqueTableNames) {
      const tableSection = this.extractTableSection(content, `### Table: \`${tableName}\``);
      if (tableSection) {
        const fields = this.extractFieldsFromSection(tableSection);
        tables.push({
          name: tableName,
          type: 'postgres',
          fields: fields
        });
      }
    }
    
    // Extract MongoDB collections - get unique collection names first
    const collectionNameRegex = /### 🔗 Collection: `([^`]+)`/g;
    const uniqueCollectionNames = new Set<string>();
    
    while ((match = collectionNameRegex.exec(content)) !== null) {
      uniqueCollectionNames.add(match[1]);
    }
    
    // For each unique collection, extract its fields
    for (const collectionName of uniqueCollectionNames) {
      const collectionSection = this.extractTableSection(content, `### 🔗 Collection: \`${collectionName}\``);
      if (collectionSection) {
        const fields = this.extractFieldsFromSection(collectionSection);
        tables.push({
          name: collectionName,
          type: 'mongodb',
          fields: fields
        });
      }
    }
    
    return tables;
  }

  /**
   * Extract a specific table/collection section from markdown content
   */
  private extractTableSection(content: string, tableHeader: string): string | null {
    const startIndex = content.indexOf(tableHeader);
    if (startIndex === -1) return null;
    
    const sectionStart = content.substring(startIndex);
    const nextTableIndex = sectionStart.indexOf('\n### ', 1);
    
    if (nextTableIndex === -1) {
      return sectionStart;
    } else {
      return sectionStart.substring(0, nextTableIndex);
    }
  }

  /**
   * Extract fields from a table/collection section
   */
  private extractFieldsFromSection(section: string): any[] {
    const fields: any[] = [];
    const fieldRegex = /\| `([^`]+)` \| `([^`]+)` \| ([^|]+) \|/g;
    let match;
    
    while ((match = fieldRegex.exec(section)) !== null) {
      const fieldName = match[1];
      const fieldType = match[2];
      const nullable = match[3];
      
      fields.push({
        name: fieldName,
        type: fieldType,
        nullable: nullable.trim() === 'NO' ? false : true
      });
    }
    
    return fields;
  }

  /**
   * Extract relationships from markdown content
   */
  private extractRelationshipsFromMarkdown(content: string): any[] {
    const relationships: any[] = [];
    
    // Extract foreign key relationships
    const fkRegex = /CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)" \("([^"]+)"\)/g;
    let match;
    
    while ((match = fkRegex.exec(content)) !== null) {
      relationships.push({
        constraint: match[1],
        fromTable: match[3], // References table
        fromField: match[4],
        toTable: match[3], // Referenced table
        toField: match[4],
        type: 'foreign_key'
      });
    }
    
    // Extract embedded relationships from MongoDB
    const embeddedRegex = /- \*\*([^*]+)\*\* \(from PostgreSQL table `([^`]+)`\)/g;
    
    while ((match = embeddedRegex.exec(content)) !== null) {
      relationships.push({
        fromTable: match[2],
        toTable: match[1],
        type: 'embedded',
        description: `Embedded ${match[1]} in collection`
      });
    }
    
    return relationships;
  }

  /**
   * Extract transformations from markdown content
   */
  private extractTransformationsFromMarkdown(content: string): any[] {
    const transformations: any[] = [];
    
    // Extract table to collection transformations
    const transformRegex = /- Table '([^']+)' converted to collection '([^']+)'/g;
    let match;
    
    while ((match = transformRegex.exec(content)) !== null) {
      transformations.push({
        sourceType: 'table',
        targetType: 'collection',
        sourceName: match[1],
        targetName: match[2],
        description: `Table ${match[1]} converted to collection ${match[2]}`
      });
    }
    
    return transformations;
  }
}
