export interface Metric {
  key: 'user_count' | 'developer_count' | 'visit_count' | 'work_count' | 'script_count' | 'blog_count' | 'message_count' | 'service_count';
  label: string;
  value: number;
  unit?: string;
  trend: number[];
}

export const mockMetrics: Metric[] = [
  { key: 'user_count', label: '注册用户', value: 128, trend: [80, 88, 95, 102, 110, 118, 128] },
  { key: 'developer_count', label: '开发者', value: 14, trend: [8, 9, 10, 11, 12, 13, 14] },
  { key: 'visit_count', label: '访问数', value: 2347, trend: [1200, 1580, 1900, 2100, 2200, 2280, 2347] },
  { key: 'work_count', label: '个人作品', value: 63, trend: [40, 45, 50, 55, 58, 61, 63] },
  { key: 'script_count', label: '脚本数', value: 31, trend: [18, 20, 23, 25, 27, 29, 31] },
  { key: 'blog_count', label: '博客文章', value: 87, trend: [60, 65, 70, 75, 79, 83, 87] },
  { key: 'message_count', label: '随记条目', value: 412, trend: [300, 330, 355, 375, 390, 402, 412] },
  { key: 'service_count', label: '工作站服务', value: 6, trend: [3, 4, 4, 5, 5, 6, 6] },
];

export const dailyVisitData = [
  { date: '06-07', visit_count: 1200, user_count: 88, work_count: 0, script_count: 1, blog_count: 0, message_count: 8, service_count: 0 },
  { date: '06-08', visit_count: 1580, user_count: 102, work_count: 1, script_count: 0, blog_count: 1, message_count: 11, service_count: 1 },
  { date: '06-09', visit_count: 1900, user_count: 115, work_count: 0, script_count: 2, blog_count: 0, message_count: 14, service_count: 0 },
  { date: '06-10', visit_count: 2100, user_count: 120, work_count: 1, script_count: 0, blog_count: 1, message_count: 17, service_count: 0 },
  { date: '06-11', visit_count: 2200, user_count: 118, work_count: 0, script_count: 1, blog_count: 0, message_count: 20, service_count: 1 },
  { date: '06-12', visit_count: 2280, user_count: 124, work_count: 0, script_count: 0, blog_count: 1, message_count: 22, service_count: 0 },
  { date: '06-13', visit_count: 2347, user_count: 128, work_count: 1, script_count: 1, blog_count: 1, message_count: 24, service_count: 0 },
];

export const dashboardRanges = ['7d', '30d', '90d'] as const;
export type DashboardRange = typeof dashboardRanges[number];
