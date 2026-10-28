"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { Dashboard, Datum, statusNames, Status } from "@/lib/types";
const colors = [
  "#17a398",
  "#6b8afd",
  "#c3a267",
  "#9f80dd",
  "#e58086",
  "#4bb6db",
  "#72b08a",
  "#94a3b8",
];
export function Bars({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 20, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 10 }}
          tickFormatter={(v) =>
            String(v).length > 18 ? String(v).slice(0, 17) + "…" : String(v)
          }
        />
        <Tooltip />
        <Bar
          isAnimationActive={false}
          dataKey="value"
          name="Total"
          fill="#17a398"
          radius={[5, 5, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
function Donut({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          isAnimationActive={false}
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={85}
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
export default function Charts({ data }: { data: Dashboard }) {
  return (
    <div className="charts">
      <section className="panel">
        <h3>Distribuição por categoria</h3>
        <Donut data={data.categories} />
      </section>
      <section className="panel">
        <h3>Status das atividades</h3>
        <Bars
          data={data.statuses.map((d) => ({
            ...d,
            name: statusNames[d.name as Status] ?? d.name,
          }))}
        />
      </section>
      <section className="panel">
        <h3>Atividades por responsável</h3>
        <Bars data={data.assignees} />
      </section>
      <section className="panel span2">
        <h3>
          Evolução mensal <small>Últimos 6 meses</small>
        </h3>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data.monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis width={32} />
            <Tooltip />
            <Legend />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="created"
              name="Criadas"
              stroke="#6b8afd"
              fill="#6b8afd"
              fillOpacity={0.1}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="completed"
              name="Concluídas"
              stroke="#17a398"
              fill="#17a398"
              fillOpacity={0.12}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <section className="panel">
        <h3>Cumprimento de SLA</h3>
        <Donut data={data.sla} />
      </section>
    </div>
  );
}
