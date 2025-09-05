# Overview

This is a Quote Management System ("Gestion Devis") built as a full-stack web application for tracking quotes, clients, and follow-ups. The application provides a comprehensive dashboard for managing client relationships, quote statuses, follow-up scheduling, and business analytics. It features a modern React frontend with TypeScript, a Node.js Express backend, and PostgreSQL database integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation
- **Charts**: Chart.js for data visualization

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API design with CRUD operations
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod schemas for request/response validation
- **Development**: Hot module replacement via Vite integration

## Database Design
- **Database**: PostgreSQL with UUID primary keys
- **Schema**: Three main entities - clients, quotes, and follow-ups
- **Relationships**: One-to-many between clients and quotes, quotes and follow-ups
- **Migration**: Drizzle Kit for schema migrations

## Key Features
- **Client Management**: CRUD operations for client information
- **Quote Tracking**: Status management (Envoyé, En attente, Relancé, Accepté, Refusé)
- **Follow-up System**: Scheduled follow-ups with date tracking
- **Analytics Dashboard**: Statistics, conversion rates, and revenue charts
- **Search & Filtering**: Real-time search across clients and quotes

## Data Storage Strategy
- **Development**: In-memory storage implementation for rapid development
- **Production**: PostgreSQL with Drizzle ORM for type safety
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple

# External Dependencies

## Database
- **PostgreSQL**: Primary database using Neon Database service (@neondatabase/serverless)
- **Drizzle ORM**: Type-safe database queries and migrations
- **Connection**: Environment-based DATABASE_URL configuration

## UI Framework
- **Radix UI**: Headless UI components for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Chart.js**: Data visualization library

## Development Tools
- **Vite**: Frontend build tool with HMR
- **TypeScript**: Type checking and development experience
- **ESBuild**: Production bundling for backend
- **Replit Integration**: Development environment optimizations

## Form Handling
- **React Hook Form**: Form state management
- **Zod**: Schema validation and type generation
- **Hookform Resolvers**: Integration between RHF and Zod

## State Management
- **TanStack Query**: Server state caching and synchronization
- **React Query**: Background updates and optimistic updates