namespace Arcweave.Interpreter;

public class RuntimeException : Exception
{
    public RuntimeException(string message) : base(message)
    {
    }
    
    public RuntimeException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public class ParseException : Exception
{
    public ParseException(string message) : base(message)
    {
    }
    
    public ParseException(string message, Exception innerException) : base(message, innerException)
    {
    }
}