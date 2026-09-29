# Chunking eficiente para RAG: calidad vs. costo computacional

Experimento de Retrieval-Augmented Generation (RAG) que compara estrategias de segmentación de documentos científicos para analizar la relación entre calidad de recuperación y costo computacional.

## Contexto académico

Proyecto desarrollado para el curso **Inteligencia Artificial** de la **Universidad ICESI**.

El trabajo realiza una replicación parcial y una extensión del artículo *Is Semantic Chunking Worth the Computational Cost?* de Qu, Tu y Bao (NAACL 2025), aplicando la comparación sobre el dataset QASPER.

## Descripción

En los sistemas RAG, los documentos extensos se dividen en fragmentos (*chunks*) antes de indexarlos y recuperar evidencia relevante para una consulta. La estrategia utilizada para construir esos fragmentos puede afectar tanto la calidad de recuperación como el costo de procesamiento.

Este proyecto compara tres estrategias bajo un mismo pipeline experimental:

- **Fixed-size:** divide el documento en grupos de oraciones de tamaño fijo y utiliza solapamiento.
- **Semantic breakpoint:** detecta cambios semánticos entre oraciones consecutivas para decidir los puntos de corte.
- **Structure-aware:** aprovecha la estructura de secciones y párrafos del documento para construir fragmentos de forma ligera.

La evaluación utiliza métricas de **Precision, Recall y F1** para recuperación de evidencia, junto con métricas de costo como tiempo de procesamiento, tokens efectivos y cantidad de chunks truncados.

Además del notebook experimental, el repositorio incluye una landing interactiva para explorar los resultados, comparar las estrategias y visualizar ejemplos de segmentación.

## Objetivo

Evaluar el comportamiento de distintas estrategias de chunking al equilibrar calidad de recuperación y costo computacional en documentos científicos utilizados dentro de un pipeline RAG.

## Alcance

- Dataset científico **QASPER**.
- Evaluación de recuperación de evidencia para `k = 1, 3, 5, 10`.
- Comparación de tres estrategias de chunking.
- Medición de Precision, Recall y F1.
- Medición de tiempo, tokens efectivos y chunks truncados.
- Exportación de resultados en JSON, CSV y JavaScript.
- Visualización interactiva de los resultados mediante una landing web.
- Importación y sincronización de nuevas corridas experimentales.

La corrida incluida se concentra en las etapas de segmentación y recuperación. La exportación no presenta respuestas generadas por un modelo cuando esa generación no fue ejecutada.

## Tecnologías

- Python
- Jupyter Notebook / Google Colab
- Hugging Face `datasets`
- Sentence Transformers
- spaCy
- RapidFuzz
- pandas
- NumPy
- Matplotlib
- ipywidgets
- HTML5
- CSS3
- JavaScript

## Datos y configuración experimental

La corrida incluida en el repositorio utiliza:

| Parámetro | Valor |
| --- | --- |
| Dataset | QASPER |
| Split | `validation` |
| Documentos | 100 |
| Preguntas | 250 |
| Modelo de embeddings | `sentence-transformers/all-mpnet-base-v2` |
| Semilla | 42 |
| Valores de `k` | 1, 3, 5, 10 |
| Fixed chunk size | 6 oraciones |
| Fixed overlap | 1 oración |
| Semantic target chunks | 8 |
| Structure max sentences | 8 |
| Structure overlap | 1 oración |

## Requisitos

### Para visualizar la landing

- Python 3.
- Un navegador web moderno.

`app.py` y la landing utilizan únicamente la biblioteca estándar de Python, por lo que no es necesario instalar dependencias adicionales para visualizar los resultados incluidos.

También puedes consultar directamente la versión publicada en GitHub Pages:

https://renzofernando.github.io/chunking_rag_interactivo/

### Para reproducir el experimento

El notebook instala las dependencias necesarias para la ejecución experimental:

```bash
pip install datasets sentence-transformers spacy rapidfuzz pandas numpy matplotlib ipywidgets
```

Se recomienda ejecutar el experimento desde Google Colab o un entorno Jupyter equivalente.

## Ejecución

### Visualizar los resultados incluidos

Clona el repositorio:

```bash
git clone https://github.com/RenzoFernando/chunking_rag_interactivo.git
cd chunking_rag_interactivo
```

Inicia el servidor local:

```bash
python app.py
```

La presentación queda disponible por defecto en:

```text
http://127.0.0.1:8000/
```

`app.py` abre el navegador automáticamente. Para iniciar el servidor sin abrirlo:

```bash
python app.py --no-browser
```

Para utilizar otro puerto:

```bash
python app.py --port 9000
```

La landing también puede abrirse directamente desde `index.html`, ya que `assets/js/results-data.js` contiene la misma corrida almacenada en `data/results.json`.

### Reproducir el experimento

El notebook principal es:

```text
Experimento_Paper_Chunking_QASPER.ipynb
```

Ejecuta sus celdas en orden para:

1. instalar las dependencias;
2. cargar QASPER;
3. normalizar los documentos y preguntas;
4. generar chunks con las tres estrategias;
5. calcular embeddings y recuperar evidencia;
6. evaluar Precision, Recall y F1;
7. medir costos de procesamiento;
8. exportar los artefactos de resultados.

El notebook genera, entre otros archivos:

```text
results.json
metrics.csv
results-data.js
```

También puede producir `resultados_chunking_para_web.zip`, utilizado para transportar una corrida completa hacia la landing.

### Importar una nueva corrida

Para cargar un ZIP o una carpeta de resultados generada por el notebook:

```bash
python app.py --import-results resultados_chunking_para_web.zip
```

Para regenerar `assets/js/results-data.js` a partir de `data/results.json`:

```bash
python app.py --sync
```

## Arquitectura

El flujo principal del proyecto es:

```text
QASPER
  │
  ▼
Notebook experimental
  │
  ├── Fixed-size
  ├── Semantic breakpoint
  └── Structure-aware
  │
  ▼
Embeddings + recuperación de evidencia
  │
  ▼
Métricas de calidad y costo
  │
  ▼
results.json / metrics.csv / results-data.js
  │
  ▼
Landing interactiva
```

Estructura principal del repositorio:

```text
chunking_rag_interactivo/
├── Experimento_Paper_Chunking_QASPER.ipynb
├── LICENSE
├── README.md
├── app.py
├── index.html
├── requirements.txt
├── resultados_chunking_para_web.zip
├── assets/
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── main.js
│       └── results-data.js
├── data/
│   ├── metrics.csv
│   ├── results.json
│   └── run_artifacts/
│       ├── calidad_vs_costo.csv
│       ├── configuracion.json
│       ├── costos.csv
│       ├── metricas_por_pregunta.csv
│       ├── metricas_resumen.csv
│       ├── metrics.csv
│       ├── results-data.js
│       └── results.json
└── doc/
    └── paper_chunking_RAG.pdf
```

`app.py` permite importar resultados, sincronizar los datos utilizados por la landing y servir la interfaz mediante un servidor HTTP local.

## Resultados

Resultados principales de la corrida incluida:

| Métrica | Fixed-size | Semantic breakpoint | Structure-aware |
| --- | ---: | ---: | ---: |
| F1@5 | 0.0515 | 0.0302 | 0.0505 |
| F1@10 | 0.0471 | 0.0248 | 0.0672 |
| Tokens efectivos | 572,404 | 711,032 | 492,023 |
| Tiempo total | 1,019.7 s | 1,211.6 s | 860.4 s |
| Chunks truncados | 36 | 385 | 7 |

En esta corrida, **Fixed-size** obtiene el F1 más alto en `k = 5` por un margen pequeño frente a **Structure-aware**.

En `k = 10`, **Structure-aware** obtiene el F1 más alto y, al mismo tiempo, registra menos tokens efectivos, menor tiempo total y menos chunks truncados que las otras dos estrategias.

**Semantic breakpoint** alcanza el Recall más alto en `k = 10` (`0.2245`), pero presenta valores de F1 inferiores y un costo computacional mayor en esta misma ejecución.

Los tiempos sirven para comparar las estrategias dentro de esta corrida y del mismo entorno de ejecución; no deben interpretarse como latencias universales.

## Documentación

- [Propuesta Paper del proyecto](doc/paper_chunking_RAG.pdf)
- [Demo interactiva](https://renzofernando.github.io/chunking_rag_interactivo/)
- [Repositorio en GitHub](https://github.com/RenzoFernando/chunking_rag_interactivo)

## Autores

- [Renzo Fernando Mosquera Daza](https://github.com/RenzoFernando)
- [Luna Catalina Martínez Vásquez](https://github.com/LunaKtalina)

## Licencia

Este proyecto se distribuye bajo la licencia MIT. Consulta [LICENSE](LICENSE) para conocer los términos completos.
