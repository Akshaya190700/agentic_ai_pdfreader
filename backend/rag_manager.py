import os
from typing import Optional
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.chains import ConversationalRetrievalChain
from langchain_community.chat_models import ChatOllama 

# Default embedding model (local, small, and fast)
DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

class RAGManager:
    def __init__(self, persist_dir: str = "./chroma_db", model_name: str = DEFAULT_EMBEDDING_MODEL):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)

        # sentence embeddings
        self.embeddings = HuggingFaceEmbeddings(model_name=model_name)

        #ollama mistral model for chat
        self.llm = ChatOllama(model="mistral", temperature=0.0)

        # To cache conversational chains per collection
        self._chains = {}

    def ingest_pdf(self, file_path: str, collection_name: str):
        """Load a PDF, split into chunks, and store in Chroma vector DB."""
        loader = PyPDFLoader(file_path)
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs = splitter.split_documents(docs)

        persist_collection_dir = os.path.join(self.persist_dir, collection_name)
        chroma = Chroma.from_documents(
            docs,
            embedding=self.embeddings,
            persist_directory=persist_collection_dir,
            collection_name=collection_name,
        )
        chroma.persist()
        self._chains.pop(collection_name, None)  # Reset cache
        return True

    def _load_vectorstore(self, collection_name: str):
        """Load a Chroma vector store by collection name."""
        persist_collection_dir = os.path.join(self.persist_dir, collection_name)
        if not os.path.exists(persist_collection_dir):
            raise ValueError(f"Collection '{collection_name}' does not exist")
        chroma = Chroma(
            persist_directory=persist_collection_dir,
            collection_name=collection_name,
            embedding_function=self.embeddings,
        )
        return chroma

    def get_conversational_chain(self, collection_name: str):
        """Return a conversational RAG chain for the given collection."""
        if collection_name in self._chains:
            return self._chains[collection_name]

        chroma = self._load_vectorstore(collection_name)
        retriever = chroma.as_retriever(search_kwargs={"k": 4})

        conv_chain = ConversationalRetrievalChain.from_llm(
            llm=self.llm,
            retriever=retriever,
            return_source_documents=True,
        )
        self._chains[collection_name] = conv_chain
        return conv_chain

    def chat(self, collection_name: str, question: str, chat_history: list):
        """Ask a question to the RAG system with chat history."""
        chain = self.get_conversational_chain(collection_name)
        result = chain({"question": question, "chat_history": chat_history})
        return result


