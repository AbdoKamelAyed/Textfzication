import { analyzeTextLinguistics } from './linguistic';
import type {
  DatasetRecord,
  ExperimentRecord,
  KnowledgeEdge,
  KnowledgeGraphData,
  KnowledgeNode,
  TextSample,
  WritingPattern,
} from './types';

export function buildKnowledgeGraphFromCorpus(params: {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
}): KnowledgeGraphData {
  const nodesMap = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];

  const addNode = (node: KnowledgeNode) => {
    if (!nodesMap.has(node.id)) {
      nodesMap.set(node.id, node);
    }
  };

  for (const ds of params.datasets) {
    addNode({
      id: `ds:${ds.dataset_key}`,
      label: ds.name,
      type: 'dataset',
      validation_status: ds.layer,
      metadata: {
        version: ds.version,
        license: ds.license,
        is_synthetic_demo: ds.is_synthetic_demo,
      },
    });
  }

  for (const exp of params.experiments) {
    addNode({
      id: `exp:${exp.experiment_key}`,
      label: exp.name,
      type: 'experiment',
      validation_status: exp.is_exploratory ? 'exploratory' : exp.status,
      metadata: {
        model_type: exp.model_type,
        f1_score: exp.metrics.f1_score,
        roc_auc: exp.metrics.roc_auc,
      },
    });
    if (nodesMap.has(`ds:${exp.dataset_key}`)) {
      edges.push({
        id: `e:${exp.experiment_key}->${exp.dataset_key}`,
        source: `exp:${exp.experiment_key}`,
        target: `ds:${exp.dataset_key}`,
        relation: 'EXPERIMENT_USES_DATASET',
        provenance: `Experiment ${exp.experiment_key}`,
        validation_status: exp.status,
      });
    }
  }

  for (const s of params.samples) {
    const metrics = s.linguistic_metrics ?? analyzeTextLinguistics(s.text);
    const sampleNodeId = `smp:${s.sample_id}`;
    addNode({
      id: sampleNodeId,
      label: s.sample_id,
      type: 'sample',
      validation_status: s.validation.status,
      metadata: {
        language: s.language,
        dialect: s.dialect,
        domain: s.domain,
        origin_class: s.origin.class,
        word_count: metrics.word_count,
        burstiness: metrics.sentence_structure.burstiness_index,
        is_synthetic_demo: s.is_synthetic_demo,
      },
    });

    if (nodesMap.has(`ds:${s.dataset_key}`)) {
      edges.push({
        id: `e:${s.sample_id}->ds:${s.dataset_key}`,
        source: sampleNodeId,
        target: `ds:${s.dataset_key}`,
        relation: 'BELONGS_TO_DATASET',
        provenance: s.provenance.dataset,
        validation_status: s.validation.status,
      });
    }

    if (s.origin.model) {
      const modelId = `mdl:${s.origin.model}`;
      addNode({
        id: modelId,
        label: s.origin.model,
        type: 'model',
        validation_status: 'verified_metadata',
        metadata: {
          model_version: s.origin.model_version ?? 'unspecified',
        },
      });
      edges.push({
        id: `e:${modelId}->${s.sample_id}`,
        source: modelId,
        target: sampleNodeId,
        relation: 'MODEL_GENERATES_SAMPLE',
        provenance: s.origin.source,
        validation_status: s.validation.status,
      });
    }

    if (s.author_pseudo_id) {
      const authId = `auth:${s.author_pseudo_id}`;
      addNode({
        id: authId,
        label: s.author_pseudo_id,
        type: 'author',
        validation_status: 'pseudonymous',
        metadata: {
          language: s.language,
        },
      });
      edges.push({
        id: `e:${authId}->${s.sample_id}`,
        source: authId,
        target: sampleNodeId,
        relation: 'AUTHORED_SAMPLE',
        provenance: s.provenance.dataset,
        validation_status: s.validation.status,
      });
    }

    // Link dominant measured linguistic feature nodes derived strictly from sample metrics
    if (metrics.sentence_structure.burstiness_index >= 0.42) {
      const featId = 'feat:HIGH_BURSTINESS';
      addNode({
        id: featId,
        label: 'High Burstiness (CV >= 0.42)',
        type: 'feature',
        validation_status: 'measured',
        metadata: { feature_id: 'SENT_BURSTINESS' },
      });
      edges.push({
        id: `e:${s.sample_id}->${featId}`,
        source: sampleNodeId,
        target: featId,
        relation: 'HAS_FEATURE',
        provenance: metrics.engine_version,
        validation_status: 'measured',
      });
    } else if (metrics.sentence_structure.burstiness_index < 0.26) {
      const featId = 'feat:LOW_BURSTINESS';
      addNode({
        id: featId,
        label: 'Uniform Cadence (CV < 0.26)',
        type: 'feature',
        validation_status: 'measured',
        metadata: { feature_id: 'SENT_BURSTINESS' },
      });
      edges.push({
        id: `e:${s.sample_id}->${featId}`,
        source: sampleNodeId,
        target: featId,
        relation: 'HAS_FEATURE',
        provenance: metrics.engine_version,
        validation_status: 'measured',
      });
    }

    if (metrics.writing_style.transition_density >= 2.0) {
      const featId = 'feat:HIGH_TRANSITIONS';
      addNode({
        id: featId,
        label: 'High Transition Density (>= 2.0/100w)',
        type: 'feature',
        validation_status: 'measured',
        metadata: { feature_id: 'STYLE_TRANSITION_DENSITY' },
      });
      edges.push({
        id: `e:${s.sample_id}->${featId}`,
        source: sampleNodeId,
        target: featId,
        relation: 'HAS_FEATURE',
        provenance: metrics.engine_version,
        validation_status: 'measured',
      });
    }
  }

  for (const pat of params.patterns) {
    const patNodeId = `pat:${pat.pattern_id}`;
    addNode({
      id: patNodeId,
      label: pat.title,
      type: 'pattern',
      validation_status: pat.validation_status,
      metadata: {
        category: pat.category,
        confidence: pat.confidence,
        discovery_method: pat.discovery_method,
      },
    });
    for (const sid of pat.supporting_samples) {
      if (nodesMap.has(`smp:${sid}`)) {
        edges.push({
          id: `e:${pat.pattern_id}->${sid}`,
          source: patNodeId,
          target: `smp:${sid}`,
          relation: 'SUPPORTED_BY_SAMPLE',
          provenance: pat.discovery_method,
          validation_status: pat.validation_status,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
    generated_at: new Date().toISOString(),
  };
}
