import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { buildKnowledgeGraphFromCorpus } from '../engine/knowledgeGraph';
import { analyzeTextLinguistics, FEATURE_CATALOG } from '../engine/linguistic';
import type {
  DatasetRecord,
  ExperimentRecord,
  KnowledgeNode,
  TextSample,
  WritingPattern,
} from '../engine/types';

interface Props {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
}

type DiagramMode = 'knowledge_graph' | 'feature_tree' | 'pipeline_flow' | 'metric_chart';

const NODE_COLORS: Record<KnowledgeNode['type'], string> = {
  sample: '#0284c7',
  dataset: '#059669',
  author: '#7c3aed',
  model: '#d97706',
  feature: '#0891b2',
  pattern: '#db2777',
  experiment: '#4f46e5',
};

export function VisualIntelligenceView({
  datasets,
  samples,
  patterns,
  experiments,
}: Props) {
  const [mode, setMode] = useState<DiagramMode>('knowledge_graph');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    vocabulary: true,
    sentence_structure: true,
    paragraph_structure: true,
    punctuation: true,
    writing_style: true,
    additional: true,
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const fullGraph = useMemo(
    () =>
      buildKnowledgeGraphFromCorpus({
        datasets,
        samples,
        patterns,
        experiments,
      }),
    [datasets, samples, patterns, experiments]
  );

  const filteredGraph = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const visibleNodes = fullGraph.nodes.filter((n) => {
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (q && !n.label.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q)) return false;
      return true;
    });
    const nodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = fullGraph.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return { nodes: visibleNodes, edges: visibleEdges };
  }, [fullGraph, typeFilter, searchQuery]);

  const selectedNode =
    fullGraph.nodes.find((n) => n.id === selectedNodeId) ?? filteredGraph.nodes[0] ?? null;

  // D3 Force Simulation for Knowledge Graph
  useEffect(() => {
    if (mode !== 'knowledge_graph' || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 880;
    const height = 500;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const container = svg.append('g');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    interface SimNode extends d3.SimulationNodeDatum {
      id: string;
      label: string;
      type: KnowledgeNode['type'];
    }
    interface SimLink extends d3.SimulationLinkDatum<SimNode> {
      id: string;
      relation: string;
    }

    const simNodes: SimNode[] = filteredGraph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
    }));
    const simLinks: SimLink[] = filteredGraph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
    }));

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(85)
      )
      .force('charge', d3.forceManyBody().strength(-185))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.09))
      .force('y', d3.forceY(height / 2).strength(0.09))
      .force('collision', d3.forceCollide(26));

    const link = container
      .append('g')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.55)
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke-width', 1.2);

    const nodeGroup = container
      .append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_ev, d) => {
        setSelectedNodeId(d.id);
      });

    nodeGroup
      .append('circle')
      .attr('r', (d) => (d.type === 'dataset' || d.type === 'pattern' ? 13 : 9))
      .attr('fill', (d) => NODE_COLORS[d.type] || '#64748b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    nodeGroup
      .append('text')
      .text((d) => (d.label.length > 22 ? `${d.label.slice(0, 20)}…` : d.label))
      .attr('x', 13)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', 'currentColor')
      .attr('class', 'text-slate-700 dark:text-slate-300');

    simulation.on('tick', () => {
      for (const n of simNodes) {
        n.x = Math.max(36, Math.min(width - 135, n.x ?? width / 2));
        n.y = Math.max(24, Math.min(height - 24, n.y ?? height / 2));
      }

      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [mode, filteredGraph]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textprint-${mode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPng = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const pngUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `textprint-${mode}.png`;
            a.click();
            URL.revokeObjectURL(pngUrl);
          }
        });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(fullGraph, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'textprint-knowledge-graph.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const featureCategories = useMemo(() => {
    const map = new Map<string, typeof FEATURE_CATALOG>();
    for (const f of FEATURE_CATALOG) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return Array.from(map.entries());
  }, []);

  const metricChartData = useMemo(() => {
    return samples.slice(0, 10).map((s) => {
      const m = s.linguistic_metrics ?? analyzeTextLinguistics(s.text);
      return {
        id: s.sample_id,
        origin: s.origin.class,
        burstiness: m.sentence_structure.burstiness_index,
        transitions: m.writing_style.transition_density,
      };
    });
  }, [samples]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            10. Knowledge Graph &amp; Visual Intelligence Engine
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Interactive data-driven visualizations generated strictly from live corpus records, provenance links, and measured metrics.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0 overflow-x-auto max-w-full">
          {(
            [
              ['knowledge_graph', 'Knowledge Graph'],
              ['feature_tree', 'Feature Tree'],
              ['pipeline_flow', 'Pipeline Flow'],
              ['metric_chart', 'Metric Plot'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'knowledge_graph' ? (
            <>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
                aria-label="Search knowledge graph nodes"
                className="px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <select
                aria-label="Filter node type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="all">All Types ({fullGraph.nodes.length})</option>
                <option value="sample">Samples</option>
                <option value="dataset">Datasets</option>
                <option value="model">LLM Models</option>
                <option value="author">Authors</option>
                <option value="feature">Features</option>
                <option value="pattern">Patterns</option>
                <option value="experiment">Experiments</option>
              </select>
              <button
                type="button"
                onClick={() => handleZoom(1.25)}
                aria-label="Zoom in graph"
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(0.8)}
                aria-label="Zoom out graph"
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset graph zoom"
                className="p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'feature_tree'
                ? 'Interactive 6-category linguistic feature taxonomy · Click categories to expand or collapse.'
                : mode === 'pipeline_flow'
                  ? 'End-to-end TEXTPRINT corpus & probabilistic evaluation architecture.'
                  : 'Burstiness CV vs. Discourse Transition Density plotted across loaded corpus samples.'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportSvg}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON Graph</span>
          </button>
        </div>
      </div>

      {mode === 'knowledge_graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
            <svg
              ref={svgRef}
              data-testid="knowledge-graph-svg"
              className="w-full h-[460px] rounded bg-slate-50 dark:bg-slate-950"
              role="img"
              aria-label="Interactive TEXTPRINT Knowledge Graph"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              {Object.entries(NODE_COLORS).map(([t, hex]) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: hex }}
                  />
                  <span>{t}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Node &amp; Provenance Inspector
            </h2>
            {!selectedNode ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any node in the graph to inspect its metadata and provenance links.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-mono text-sky-700 dark:text-sky-400 uppercase">
                    {selectedNode.type}
                  </span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedNode.label}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    ID: {selectedNode.id} · Status: {selectedNode.validation_status}
                  </p>
                </div>

                <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] space-y-1">
                  {Object.entries(selectedNode.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">{k}</span>
                      <span className="text-slate-900 dark:text-slate-100 text-right">
                        {String(v)}
                      </span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Connected Relationships
                  </p>
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {fullGraph.edges
                      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((e) => (
                        <li
                          key={e.id}
                          className="p-1.5 rounded border border-slate-100 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                        >
                          {e.relation} → {e.source === selectedNode.id ? e.target : e.source}
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                            Provenance: {e.provenance} ({e.validation_status})
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'feature_tree' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Hierarchical Linguistic Feature Taxonomy (Expand / Collapse)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureCategories.map(([cat, specs]) => {
              const open = expandedCategories[cat] ?? true;
              return (
                <div
                  key={cat}
                  className="border border-slate-200 dark:border-slate-800 rounded-md p-3.5 space-y-2"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategories((prev) => ({ ...prev, [cat]: !open }))
                    }
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <span className="capitalize">{cat.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-sky-700 dark:text-sky-400">
                      {open ? '−' : '+'} ({specs.length})
                    </span>
                  </button>
                  {open && (
                    <ul className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                      {specs.map((f) => (
                        <li key={f.feature_id} className="space-y-0.5">
                          <span className="font-mono text-[11px] text-sky-700 dark:text-sky-400">
                            {f.feature_id}
                          </span>
                          <p className="text-slate-800 dark:text-slate-200">{f.name}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'pipeline_flow' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            TEXTPRINT Scientific Pipeline Architecture
          </h2>
          <svg
            ref={svgRef}
            viewBox="0 0 960 220"
            className="w-full bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800"
            role="img"
            aria-label="TEXTPRINT pipeline process flow"
          >
            {[
              { label: '1. COLLECT', count: `${samples.length} total` },
              { label: '2. VALIDATE', count: `${samples.filter((s) => s.validation.verified).length} ok` },
              { label: '3. ORGANIZE', count: `${datasets.length} sets` },
              { label: '4. ANALYZE', count: `${FEATURE_CATALOG.length} feats` },
              { label: '5. DISCOVER', count: `${patterns.length} pats` },
              { label: '6. EVALUATE', count: `${experiments.length} runs` },
            ].map((step, i) => {
              const x = 20 + i * 156;
              return (
                <g key={step.label}>
                  <rect
                    x={x}
                    y={60}
                    width={132}
                    height={84}
                    rx={6}
                    className="fill-white dark:fill-slate-900 stroke-sky-600 dark:stroke-sky-400"
                    strokeWidth={1.5}
                  />
                  <text
                    x={x + 66}
                    y={94}
                    textAnchor="middle"
                    className="fill-slate-900 dark:fill-slate-100 text-[11px] font-mono font-semibold"
                  >
                    {step.label}
                  </text>
                  <text
                    x={x + 66}
                    y={118}
                    textAnchor="middle"
                    className="fill-sky-700 dark:fill-sky-400 text-[11px] font-mono"
                  >
                    {step.count}
                  </text>
                  {i < 5 && (
                    <line
                      x1={x + 132}
                      y1={102}
                      x2={x + 156}
                      y2={102}
                      className="stroke-slate-400"
                      strokeWidth={1.5}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {mode === 'metric_chart' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Sample Burstiness vs. Transition Density Scatter
          </h2>
          <svg
            ref={svgRef}
            viewBox="0 0 800 340"
            className="w-full bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800"
            role="img"
            aria-label="Burstiness versus Transition Density plot"
          >
            <line x1={60} y1={280} x2={750} y2={280} className="stroke-slate-400" strokeWidth={1} />
            <line x1={60} y1={30} x2={60} y2={280} className="stroke-slate-400" strokeWidth={1} />
            <text x={400} y={320} textAnchor="middle" className="fill-slate-500 text-[11px] font-mono">
              Sentence Burstiness (CV) →
            </text>
            <text
              x={22}
              y={155}
              textAnchor="middle"
              transform="rotate(-90 22 155)"
              className="fill-slate-500 text-[11px] font-mono"
            >
              Transitions / 100w →
            </text>
            {metricChartData.map((pt) => {
              const x = 60 + Math.min(1, pt.burstiness / 0.8) * 660;
              const y = 280 - Math.min(1, pt.transitions / 5) * 230;
              const color =
                pt.origin === 'human'
                  ? '#059669'
                  : pt.origin === 'ai'
                    ? '#0284c7'
                    : '#d97706';
              return (
                <g key={pt.id}>
                  <circle cx={x} cy={y} r={6} fill={color} />
                  <text
                    x={x + 9}
                    y={y + 3}
                    className="fill-slate-700 dark:fill-slate-300 text-[10px] font-mono"
                  >
                    {pt.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
