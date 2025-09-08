# Peer AI MongoDB Migrator

A sophisticated AI-powered database migration and analysis tool that intelligently migrates PostgreSQL databases to MongoDB with comprehensive schema analysis, code migration assistance, and interactive natural language querying.

## 🚀 Key Features

### **Interactive Natural Language Interface**
The agent understands and responds to human-like commands for database analysis and migration:

- **Database Architecture Analysis**: "Can you examine my postgres database architecture"
- **Schema Conversion**: "Can you tell what will be the similar mongodb schema for this"
- **Code Analysis**: "Analyze my application codes, as I am planning to migrate to mongodb"
- **Specific Queries**: 
  - "How many columns are in my {table_name}?"
  - "How should I handle the {table names} relationship in MongoDB?"
  - "Why did you choose to embed language data in films?"
  - "What are the recommended security configurations for my schema?"

### **Interactive Credential Management**
- **No Configuration Files Required**: The agent interactively prompts for database credentials on startup
- **Secure Memory-Only Storage**: Credentials are stored in memory and automatically wiped on closure
- **No Persistent Storage**: No mcp-config.json or other credential files needed

## 🏗️ Architecture

### **Core Components**

#### **CLI Layer** (`src/cli/`)
- **CLI.ts**: Main command-line interface with natural language processing
- **GitHubCLI.ts**: Dedicated GitHub repository analysis interface

#### **Configuration Management** (`src/config/`)
- **Interactive Credentials**: Secure, in-memory credential prompting
- **Interactive Setup**: User-friendly database connection setup
- **LLM Configuration**: Azure OpenAI integration for AI capabilities

#### **Core Services** (`src/core/`)
- **MCPAgent**: Central orchestrator for all database operations
- **MCPBridge**: Tool mapping and simulation layer
- **MCPClient**: Robust database communication with retry logic
- **RealMCPServer**: Actual PostgreSQL and MongoDB connections

#### **Analysis Services** (`src/services/`)
- **Schema Analysis**: Comprehensive PostgreSQL schema introspection
- **MongoDB Design**: Intelligent collection design and optimization
- **Migration Planning**: End-to-end migration strategy generation
- **Code Analysis**: Spring Boot to Node.js migration assistance
- **Query Pattern Analysis**: Performance optimization insights

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd peer-ai-mongo-migrator

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your Azure OpenAI credentials
```

## 🚀 Quick Start

### **1. Start the Interactive Agent**
```bash
npm start
```

The agent will:
- Prompt for PostgreSQL connection details
- Prompt for MongoDB connection details
- Initialize all services
- Present the interactive command interface

### **2. Natural Language Commands**

#### **Database Analysis**
```
> Can you examine my postgres database architecture
> How many tables are in my database?
> What are the relationships between my tables?
```

#### **Schema Migration**
```
> Can you tell what will be the similar mongodb schema for this
> How should I handle the user-orders relationship in MongoDB?
> Why did you choose to embed product data in orders?
```

#### **Code Analysis**
```
> Analyze my application codes, as I am planning to migrate to mongodb
> What Spring Boot entities need to be migrated?
> How should I handle JPA repositories in MongoDB?
```

#### **Specific Queries**
```
> How many columns are in my users table?
> What are the recommended indexes for my products collection?
> What are the security considerations for my schema?
```

## 🔧 Available Commands

### **Database Operations**
- `analyze postgres` - Comprehensive PostgreSQL schema analysis
- `analyze mongodb` - MongoDB schema analysis and optimization
- `compare schemas` - Compare PostgreSQL and MongoDB schemas
- `migrate data` - Execute data migration between databases

### **Schema Management**
- `generate er-diagram` - Create ER diagrams in multiple formats
- `generate mongodb-schema` - Convert PostgreSQL to MongoDB schema
- `validate schema` - Validate database schemas and relationships

### **Migration Planning**
- `analyze migration` - Generate comprehensive migration plan
- `estimate effort` - Calculate migration complexity and effort
- `generate documentation` - Create detailed migration documentation

### **GitHub Integration**
- `analyze github <url>` - Analyze GitHub repository for migration
- `clone repository <url>` - Clone and analyze external repository
- `extract code patterns` - Extract migration-relevant code patterns

## 🧠 AI-Powered Features

### **Natural Language Processing**
- **Intent Recognition**: Understands complex migration queries
- **Context Awareness**: Maintains conversation context across queries
- **Smart Suggestions**: Provides relevant next steps and recommendations

### **Intelligent Schema Design**
- **Relationship Analysis**: Automatically identifies embedding opportunities
- **Performance Optimization**: Suggests indexes and query optimizations
- **Business Logic Preservation**: Maintains data integrity and business rules

### **Migration Intelligence**
- **Code Pattern Recognition**: Identifies Spring Boot patterns for migration
- **Dependency Analysis**: Maps complex database relationships
- **Risk Assessment**: Evaluates migration complexity and potential issues

## 📊 Analysis Capabilities

### **PostgreSQL Analysis**
- **Comprehensive Schema Introspection**: Tables, views, functions, triggers, indexes
- **Relationship Mapping**: Foreign keys, constraints, and dependencies
- **Performance Metrics**: Query patterns, statistics, and optimization opportunities
- **Business Process Inference**: Automatic detection of business workflows

### **MongoDB Design**
- **Intelligent Collection Design**: Optimal document structure and relationships
- **Embedding Strategy**: Smart decisions on when to embed vs. reference
- **Index Recommendations**: Performance-optimized indexing strategies
- **Migration Complexity Assessment**: Effort estimation and risk analysis

### **Code Migration**
- **Entity Analysis**: JPA entities to MongoDB document mapping
- **Repository Patterns**: Spring Data JPA to MongoDB driver conversion
- **Service Layer**: Business logic migration strategies
- **Configuration Updates**: Application configuration changes

## 🔒 Security & Privacy

- **No Persistent Credentials**: All database credentials are memory-only
- **Secure Communication**: Encrypted connections to databases
- **Temporary Storage**: Analysis files are created locally and can be cleaned up
- **No Data Persistence**: No sensitive data is stored permanently

## 📁 Project Structure

```
src/
├── cli/                    # Command-line interfaces
├── config/                 # Configuration management
├── core/                   # Core services and agents
├── server/                 # MCP server implementation
├── services/               # Analysis and migration services
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions
```

## 🚀 Getting Started Examples

### **1. Basic Database Analysis**
```bash
npm start
> Can you examine my postgres database architecture
> How many tables do I have?
> What are the main relationships?
```

### **2. Schema Migration Planning**
```bash
> Can you tell what will be the similar mongodb schema for this
> How should I handle the user-profile relationship?
> What indexes should I create?
```

### **3. Code Migration Analysis**
```bash
> Analyze my application codes, as I am planning to migrate to mongodb
> What entities need the most changes?
> How should I handle my repositories?
```

---

**Built with ❤️ for seamless PostgreSQL to MongoDB migrations**
