# Chunking RAG · QASPER

La fuente de verdad del proyecto es `Experimento_Paper_Chunking_QASPER.ipynb`. La comparación usa **Fixed-size**, **Semantic breakpoint** y **Structure-aware** sobre QASPER.

## Qué se corrigió

El notebook ahora exporta resultados de forma compatible con Windows, Jupyter local y Google Colab. El problema anterior era que la exportación siempre usaba `/content`: en Windows eso terminaba creando archivos fuera de la carpeta del proyecto, mientras `index.html` seguía leyendo el `results-data.js` vacío incluido originalmente.

Si el notebook se ejecuta dentro de esta carpeta, al finalizar actualiza directamente:

```text
data/results.json
assets/js/results-data.js
data/metrics.csv
```

Por tanto, después de **Run all** basta con recargar `index.html`. No hay que copiar datos manualmente.

También se corrigieron las advertencias que parecían errores: el conteo de tokens ya no fuerza secuencias mayores al límite del tokenizer, se usa la API actual para consultar la dimensión del embedding y se desactiva la advertencia de symlinks de Hugging Face en Windows.

La evaluación conserva la lógica del notebook recibido. Se añadió `k=10` para mantener `k = {1, 3, 5, 10}` en futuras ejecuciones.

## La ejecución que ya hiciste

El notebook que enviaste conserva una ejecución de prueba con `DEMO_MODE=True`: **20 documentos y 40 preguntas**. Esta entrega recupera esos resultados guardados y los muestra desde el primer momento en la landing.

En esa ejecución:

| Estrategia | F1@5 | Tokens de embeddings | Tiempo total | Chunks truncados |
|---|---:|---:|---:|---:|
| Fixed-size | 0.0678 | 113,325 | 29.76 s | 69 |
| Semantic breakpoint | 0.0469 | 132,477 | 44.52 s | 95 |
| Structure-aware | 0.0877 | 99,405 | 32.09 s | 18 |

Son resultados de la **muestra de verificación**, no de una corrida final completa.

## Volver a ejecutar

Abre `Experimento_Paper_Chunking_QASPER.ipynb` desde esta misma carpeta y ejecuta todas las celdas.

Para una prueba corta:

```python
DEMO_MODE = True
```

Para la ejecución más amplia definida en el notebook:

```python
DEMO_MODE = False
```

Al terminar se crea además `resultados_chunking_para_web.zip` como copia portable de los resultados.

## Abrir la landing

Puede abrirse `index.html` directamente. Si prefieres un servidor local:

```bash
python app.py
```

Si la corrida se hizo en Google Colab y descargaste `resultados_chunking_para_web.zip`, colócalo en la raíz del proyecto y ejecuta `python app.py`: el script lo detecta e importa si es más reciente. También puedes hacerlo explícitamente:

```bash
python app.py --import-results resultados_chunking_para_web.zip
```

## Qué muestra la landing

La página representa los tres métodos con una animación que inicia cuando la sección entra en pantalla y vuelve a ejecutarse cada vez que se cambia de método. Los resultados incluyen F1/Precision/Recall por `k`, tokens, tiempo, calidad frente a costo, tamaño y truncamiento de chunks, y un ejemplo real guardado en el notebook.

La lectura final se calcula a partir de los valores presentes en `results.json`; no está escrita para forzar una conclusión distinta a lo que produzca la corrida.
