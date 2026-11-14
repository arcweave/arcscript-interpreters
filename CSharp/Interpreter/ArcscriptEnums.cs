using System.Collections.Generic;

namespace Arcweave.Interpreter
{
    public sealed class EnumMemberDefinition
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public object Value { get; set; }
    }

    public sealed class EnumDefinition
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public List<EnumMemberDefinition> Members { get; set; } = new List<EnumMemberDefinition>();
    }

}
