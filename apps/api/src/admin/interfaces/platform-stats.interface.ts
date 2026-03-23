export interface PlatformStats {
  totalUsers: number;
  newUsersThisMonth: number;
  premiumUsers: number;
  recruiterUsers: number;
  totalJobs: number;
  activeJobs: number;
  jobsThisWeek: number;
  totalApplications: number;
  activeSubscriptions: number;
  monthlyRevenueFcfa: number;
  jobsPerSource: Record<string, number>;
}
