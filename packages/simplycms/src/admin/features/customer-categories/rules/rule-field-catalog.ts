import type { MessageKey } from 'simplycms/i18n';
import type {
  CategoryRuleField,
  CategoryRuleOperator,
} from 'simplycms/domain/user-categories';

export interface RuleFieldMeta {
  readonly value: CategoryRuleField;
  readonly label: MessageKey;
  /** Числове поле: значення вводиться числом, оператори — порівняння. */
  readonly numeric: boolean;
  /** UTM-поле: мітки поки не збираються автоматично (З-6) — потрібна підказка. */
  readonly utm: boolean;
}

/** Поля умов; код зберігається в БД, підпис — з каталогу. */
export const RULE_FIELDS: readonly RuleFieldMeta[] = [
  {
    value: 'total_purchases',
    label: 'admin.users.rules.field.totalPurchases',
    numeric: true,
    utm: false,
  },
  {
    value: 'orders_count',
    label: 'admin.users.rules.field.ordersCount',
    numeric: true,
    utm: false,
  },
  {
    value: 'registration_days',
    label: 'admin.users.daysSince',
    numeric: true,
    utm: false,
  },
  {
    value: 'email_domain',
    label: 'admin.users.emailDomain',
    numeric: false,
    utm: false,
  },
  {
    value: 'auth_provider',
    label: 'admin.users.rules.field.authProvider',
    numeric: false,
    utm: false,
  },
  {
    value: 'utm_source',
    label: 'admin.customerCategories.rules.field.utmSource',
    numeric: false,
    utm: true,
  },
  {
    value: 'utm_campaign',
    label: 'admin.customerCategories.rules.field.utmCampaign',
    numeric: false,
    utm: true,
  },
];

export const fieldMeta = (field: string): RuleFieldMeta | undefined =>
  RULE_FIELDS.find((f) => f.value === field);

/** Підпис оператора; математичні символи перекладу не потребують. */
export function operatorLabel(
  op: CategoryRuleOperator,
  numeric: boolean,
): { key: MessageKey } | { text: string } {
  if (op === 'contains') return { key: 'admin.users.rules.op.contains' };
  if (op === '=' && !numeric) return { key: 'admin.users.rules.op.equals' };
  return { text: op };
}
