/**
 * Validation obligatoire des variables d'environnement sensibles
 * Mandatory validation of sensitive environment variables
 */

type EnvironmentMode = "development" | "production" | "test";

interface EnvVarRule {
  name: string;
  required: boolean;
  sensitive: boolean;
  description: string;
  validate?: (value: string) => boolean;
  defaultValue?: string;
  requiredInModes?: EnvironmentMode[];
}

// Configuration des variables d'environnement sensibles
const ENV_RULES: EnvVarRule[] = [
  {
    name: "DATABASE_URL",
    required: true,
    sensitive: true,
    description: "URL de connexion à la base de données",
    validate: (value: string) => {
      // Validation basique d'une URL de base de données
      return value.includes("://") && value.length > 10;
    }
  },
  {
    name: "JWT_SECRET",
    required: true,
    sensitive: true,
    description: "Secret pour signer les tokens JWT",
    validate: (value: string) => {
      // En production, le secret doit être suffisamment long et complexe
      const mode = getCurrentEnvironmentMode();
      if (mode === "production") {
        return value.length >= 32 && value !== "dev-secret-change";
      }
      return value.length >= 8;
    }
  },
  {
    name: "SMTP_HOST",
    required: false,
    sensitive: true,
    description: "Serveur SMTP pour l'envoi d'emails",
    validate: (value: string) => {
      // Validation basique d'un hostname
      return value.length > 0 && /^[a-zA-Z0-9.-]+$/.test(value);
    },
    requiredInModes: ["production"]
  },
  {
    name: "SMTP_USER",
    required: false,
    sensitive: true,
    description: "Utilisateur SMTP",
    validate: (value: string) => value.length > 0,
    requiredInModes: ["production"]
  },
  {
    name: "SMTP_PASS",
    required: false,
    sensitive: true,
    description: "Mot de passe SMTP",
    validate: (value: string) => value.length > 0,
    requiredInModes: ["production"]
  },
  {
    name: "CORS_ORIGIN",
    required: false,
    sensitive: true,
    description: "Origines autorisées pour CORS",
    validate: (value: string) => {
      // Validation des origines CORS (URLs ou domaines)
      const origins = value.split(",").map(s => s.trim());
      return origins.every(origin => 
        origin === "*" || 
        origin.startsWith("http://") || 
        origin.startsWith("https://") ||
        /^[a-zA-Z0-9.-]+$/.test(origin)
      );
    }
  },
  {
    name: "COOKIE_DOMAIN",
    required: false,
    sensitive: true,
    description: "Domaine pour les cookies",
    validate: (value: string) => {
      // Validation basique d'un domaine
      return /^[a-zA-Z0-9.-]+$/.test(value);
    }
  },
  {
    name: "NODE_ENV",
    required: true,
    sensitive: false,
    description: "Mode d'environnement",
    validate: (value: string) => ["development", "production", "test"].includes(value),
    defaultValue: "development"
  },
  {
    name: "PORT",
    required: false,
    sensitive: false,
    description: "Port d'écoute du serveur",
    validate: (value: string) => {
      const port = parseInt(value, 10);
      return !isNaN(port) && port > 0 && port <= 65535;
    },
    defaultValue: "5000"
  }
];

function getCurrentEnvironmentMode(): EnvironmentMode {
  const env = process.env.NODE_ENV as EnvironmentMode;
  return ["development", "production", "test"].includes(env) ? env : "development";
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    total: number;
    validated: number;
    missing: number;
    invalid: number;
    sensitive: number;
  };
}

/**
 * Valide toutes les variables d'environnement sensibles
 */
export function validateEnvironmentVariables(): ValidationResult {
  const currentMode = getCurrentEnvironmentMode();
  const errors: string[] = [];
  const warnings: string[] = [];
  let validated = 0;
  let missing = 0;
  let invalid = 0;
  let sensitiveCount = 0;

  console.log(`[ENV-VALIDATION] Validation des variables d'environnement en mode: ${currentMode}`);

  for (const rule of ENV_RULES) {
    const value = process.env[rule.name];
    const isRequired = rule.required || (rule.requiredInModes && rule.requiredInModes.includes(currentMode));
    
    if (rule.sensitive) {
      sensitiveCount++;
    }

    // Vérifier si la variable est manquante
    if (!value) {
      if (rule.defaultValue) {
        process.env[rule.name] = rule.defaultValue;
        warnings.push(`Variable ${rule.name} manquante, utilisation de la valeur par défaut`);
        validated++;
      } else if (isRequired) {
        errors.push(`Variable obligatoire manquante: ${rule.name} - ${rule.description}`);
        missing++;
      } else {
        warnings.push(`Variable optionnelle manquante: ${rule.name} - ${rule.description}`);
      }
      continue;
    }

    // Valider la valeur si une fonction de validation est fournie
    if (rule.validate && !rule.validate(value)) {
      errors.push(`Variable invalide: ${rule.name} - ${rule.description}`);
      invalid++;
      continue;
    }

    validated++;
    
    // Log sécurisé (ne pas afficher les valeurs sensibles)
    if (rule.sensitive) {
      console.log(`[ENV-VALIDATION] ✓ ${rule.name}: [MASQUÉ] (${rule.description})`);
    } else {
      console.log(`[ENV-VALIDATION] ✓ ${rule.name}: ${value} (${rule.description})`);
    }
  }

  // Vérifications spéciales pour les groupes de variables
  validateSMTPConfiguration(errors, warnings);

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      total: ENV_RULES.length,
      validated,
      missing,
      invalid,
      sensitive: sensitiveCount
    }
  };

  // Log du résumé
  console.log(`[ENV-VALIDATION] Résumé: ${validated}/${ENV_RULES.length} variables validées, ${errors.length} erreurs, ${warnings.length} avertissements`);
  
  if (warnings.length > 0) {
    console.warn(`[ENV-VALIDATION] Avertissements:`);
    warnings.forEach(warning => console.warn(`[ENV-VALIDATION] ⚠️  ${warning}`));
  }

  if (errors.length > 0) {
    console.error(`[ENV-VALIDATION] Erreurs:`);
    errors.forEach(error => console.error(`[ENV-VALIDATION] ❌ ${error}`));
  }

  return result;
}

/**
 * Validation spéciale pour la configuration SMTP
 * Les variables SMTP doivent être présentes ensemble ou absentes ensemble
 */
function validateSMTPConfiguration(errors: string[], warnings: string[]): void {
  const smtpVars = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const presentVars = smtpVars.filter(name => process.env[name]);
  const mode = getCurrentEnvironmentMode();

  if (presentVars.length > 0 && presentVars.length < smtpVars.length) {
    errors.push(`Configuration SMTP incomplète. Variables présentes: ${presentVars.join(", ")}. Variables manquantes: ${smtpVars.filter(name => !process.env[name]).join(", ")}`);
  }

  if (mode === "production" && presentVars.length === 0) {
    warnings.push("Configuration SMTP manquante en production. Les notifications par email seront désactivées.");
  }
}

/**
 * Validation stricte qui lève une exception si la validation échoue
 * À utiliser au démarrage de l'application
 */
export function validateEnvironmentVariablesOrThrow(): ValidationResult {
  const result = validateEnvironmentVariables();
  
  if (!result.valid) {
    const errorMessage = [
      "❌ Échec de la validation des variables d'environnement",
      "",
      "Erreurs:",
      ...result.errors.map(error => `  - ${error}`),
      "",
      "L'application ne peut pas démarrer avec une configuration invalide.",
      "Veuillez corriger les erreurs ci-dessus et redémarrer l'application."
    ].join("\n");
    
    throw new Error(errorMessage);
  }

  return result;
}

/**
 * Valide une variable d'environnement spécifique
 */
export function validateSingleEnvironmentVariable(name: string): { valid: boolean; error?: string } {
  const rule = ENV_RULES.find(r => r.name === name);
  if (!rule) {
    return { valid: false, error: `Variable d'environnement inconnue: ${name}` };
  }

  const value = process.env[name];
  const currentMode = getCurrentEnvironmentMode();
  const isRequired = rule.required || (rule.requiredInModes && rule.requiredInModes.includes(currentMode));

  if (!value) {
    if (isRequired) {
      return { valid: false, error: `Variable obligatoire manquante: ${name}` };
    }
    return { valid: true }; // Variable optionnelle manquante est ok
  }

  if (rule.validate && !rule.validate(value)) {
    return { valid: false, error: `Variable invalide: ${name}` };
  }

  return { valid: true };
}

/**
 * Obtient la liste des variables d'environnement sensibles
 */
export function getSensitiveEnvironmentVariables(): string[] {
  return ENV_RULES.filter(rule => rule.sensitive).map(rule => rule.name);
}

/**
 * Obtient les règles de validation pour une variable spécifique
 */
export function getEnvironmentVariableRule(name: string): EnvVarRule | undefined {
  return ENV_RULES.find(rule => rule.name === name);
}