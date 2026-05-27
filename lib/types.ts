// User types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
}

// CSV Upload types
export interface CSVUpload {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  row_count: number;
  uploaded_at: string;
  status: "pending" | "processed" | "error";
  error_message?: string;
}

export interface CSVData {
  id: string;
  upload_id: string;
  row_number: number;
  data: Record<string, string>;
  phone_number?: string;
  is_duplicate: boolean;
  created_at: string;
}

export interface CSVUploadRequest {
  file: File;
}

export interface CSVUploadResponse {
  success: boolean;
  message: string;
  upload_id?: string;
  row_count?: number;
  duplicate_count?: number;
}

// Segmentation types
export interface SegmentationRule {
  field: string;
  operator: "equals" | "contains" | "starts_with" | "greater_than" | "less_than";
  value: string;
}

export interface ExportRequest {
  upload_id: string;
  rules: SegmentationRule[];
}

export interface ExportResponse {
  success: boolean;
  message: string;
  download_url?: string;
  row_count?: number;
}

// Upload history
export interface UploadHistory {
  id: string;
  filename: string;
  row_count: number;
  duplicate_count: number;
  uploaded_at: string;
  status: string;
}
