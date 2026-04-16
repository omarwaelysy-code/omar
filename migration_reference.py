from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text, DECIMAL, BigInteger, TIMESTAMP, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import uuid

Base = declarative_base()

class Company(Base):
    __tablename__ = 'companies'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    tax_number = Column(String(50))
    commercial_register = Column(String(50))
    address = Column(Text)
    phone = Column(String(20))
    email = Column(String(100))
    subscription_status = Column(Enum('active', 'expired', 'trial', 'suspended'), default='trial')
    subscription_plan = Column(Enum('basic', 'pro', 'enterprise'), default='basic')
    subscription_expiry = Column(DateTime)
    company_status = Column(Enum('active', 'suspended'), default='active')
    created_at = Column(TIMESTAMP, default=datetime.datetime.utcnow)

class User(Base):
    __tablename__ = 'users'
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    mobile = Column(String(20))
    role_id = Column(String(36), ForeignKey('roles.id'))
    company_id = Column(String(36), ForeignKey('companies.id'))
    must_change_password = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.datetime.utcnow)

# Example CRUD in Python
def create_company(session, name, code):
    new_company = Company(name=name, code=code)
    session.add(new_company)
    session.commit()
    return new_company

def get_company_invoices(session, company_id):
    # Equivalent to Firestore: db.collection('invoices').where('company_id', '==', company_id).get()
    return session.query(Invoice).filter(Invoice.company_id == company_id).all()

# Database Setup
# engine = create_engine('mysql+mysqlconnector://user:password@host/dbname')
# Session = sessionmaker(bind=engine)
# session = Session()
