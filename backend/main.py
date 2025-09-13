import os, uuid, traceback, re
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_manager import RAGManager
from tools import safe_eval

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
rag = RAGManager(persist_dir=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"))

# simple in-memory chat history store
chat_histories = {}


class ChatRequest(BaseModel):
    session_id: str
    message: str


@app.post("/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        doc_id = str(uuid.uuid4())[:8]
        filename = f"{doc_id}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(contents)

        # ingest into vectorstore
        rag.ingest_pdf(filepath, collection_name=doc_id)

        # initialize chat history
        chat_histories[doc_id] = []

        return {"doc_id": doc_id, "filename": file.filename}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        sess = req.session_id.strip()
        msg = req.message.strip()

        # --- 1) Calculator branch ---
        arithmetic_like = re.fullmatch(r'[\d\s\+\-\*\/\.\%\(\)]+', msg)
        if "calculate" in msg.lower() or arithmetic_like:
            # Extract expression
            if "calculate" in msg.lower():
                expr_match = re.search(r'calculate\s*(.+)', msg.lower())
                expr = expr_match.group(1).strip() if expr_match else ""
            else:
                expr = msg

            if not expr:
                return {
                    "answer": "Please provide an expression, e.g. 'calculate 12 * (3 + 4)'."
                }

            try:
                result = safe_eval(expr)
                # Append to history if session exists
                if sess in chat_histories:
                    chat_histories[sess].append((msg, str(result)))
                return {"answer": f"Result: {result}"}
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not evaluate expression '{expr}': {e}",
                )

        # --- 2) RAG branch ---
        if sess not in chat_histories:
            raise HTTPException(
                status_code=404,
                detail="Session/doc_id not found. Upload a PDF first via /upload_pdf.",
            )

        history = chat_histories[sess]
        out = rag.chat(sess, msg, history)

        answer = out.get("answer") or out.get("result") or str(out)
        chat_histories[sess].append((msg, answer))

        sources = []
        if out.get("source_documents"):
            for d in out["source_documents"]:
                meta = getattr(d, "metadata", {})
                text = getattr(d, "page_content", str(d))
                sources.append({"metadata": meta, "text_snippet": text[:500]})

        return {"answer": answer, "sources": sources}

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
