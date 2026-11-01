export type Role = 'admin' | 'director' | 'manager' | 'employee';
export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cleared';

export type User = {
  id: string;
  email: string;
  full_name: string;
  employee_code?: string | null;
  department?: string | null;
  role: Role;
  manager_id?: string | null;
  manager_name?: string | null;
  is_active: boolean;
  capabilities: string[];
};

export type Company = { id: string; name: string; currency: string; timezone: string };

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
  company: Company;
};

export type Category = { id: string; code: string; name: string; icon: string; sort_order: number; is_active: boolean };

export type PolicyRule = {
  id?: string;
  category_id: string | null;
  category_code?: string | null;
  category_name?: string | null;
  max_per_claim: number | null;
  max_per_month: number | null;
  receipt_required_above: number;
  max_days_to_submit: number | null;
  notes?: string | null;
};

export type PolicyFlag = { code: string; message: string; severity: 'warn' | 'block' };

export type Extraction = {
  is_receipt: boolean;
  vendor: string | null;
  spent_on: string | null;
  currency: string | null;
  total: number | null;
  tax: number | null;
  category: string | null;
  invoice_no: string | null;
  lines: { description: string; quantity: number | null; unit_price: number | null; amount: number | null }[];
  confidence: 'high' | 'medium' | 'low';
  notes: string | null;
};

export type Receipt = {
  id: string;
  claim_id: string | null;
  content_type: string;
  byte_size: number;
  extraction_status: 'pending' | 'done' | 'failed' | 'skipped';
  extraction?: Extraction | null;
  extraction_error?: string | null;
  extraction_model?: string | null;
  created_at: string;
};

export type Claim = {
  id: string;
  claim_no: number;
  employee: { id: string; full_name: string; employee_code?: string | null; department?: string | null };
  title: string;
  category: { id: string; code: string; name: string } | null;
  vendor: string | null;
  spent_on: string;
  period: string;
  currency: string;
  amount: number;
  tax_amount: number;
  notes: string | null;
  status: ClaimStatus;
  policy_flags: PolicyFlag[];
  submitted_at: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  cleared_at: string | null;
  receipt_count: number;
  created_at: string;
  updated_at: string;
};

export type ClaimLine = { id?: string; description: string; quantity: number | null; unit_price: number | null; amount: number };
export type ClaimEvent = { id: string; action: string; note: string | null; actor_name: string | null; created_at: string };

export type ClaimDetail = { claim: Claim; lines: ClaimLine[]; receipts: Receipt[]; events: ClaimEvent[] };

export type ClaimInput = {
  title: string;
  category_id: string | null;
  vendor: string | null;
  spent_on: string;
  currency?: string | null;
  amount: number;
  tax_amount: number;
  notes: string | null;
  lines: { description: string; quantity: number | null; unit_price: number | null; amount: number }[];
  receipt_ids: string[];
  submit: boolean;
};

export type MonthSummary = {
  period: string;
  claims: number;
  submitted: number;
  approved: number;
  rejected: number;
  cleared: number;
  approved_amount: number;
  cleared_amount: number;
  pending_amount: number;
  closed_at: string | null;
  closed_by_name: string | null;
};

export type MonthDetail = {
  month: MonthSummary;
  by_employee: {
    employee_id: string;
    full_name: string;
    employee_code: string | null;
    department: string | null;
    manager_name: string | null;
    claims: number;
    pending: number;
    approved_amount: number;
    pending_amount: number;
    rejected_amount: number;
  }[];
  by_category: { category: string; claims: number; approved_amount: number; pending_amount: number }[];
  flagged: Claim[];
};

export type ApprovalQueue = { items: Claim[]; total: number; total_amount: number; flagged: number };
