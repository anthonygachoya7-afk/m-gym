import os
from langchain_community.document_loaders import TextLoader,DirectoryLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv

loader=DirectoryLoader("C:\gachoya\excel data\Project-Management-Sample-Data.xlsx")
docs=loader.load()