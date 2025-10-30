using NUnit.Framework;
using Infrastructure.Services;
using Domain.Entities;

[TestFixture]
public class ValidadorDatosServiceTests
{
    [Test]
    public void ValidarDatosAlerta_AlertaInvalida_ReturnsFalse()
    {
        var service = new ValidadorDatosService();
        var alerta = new Alerta("", 0, 0, 0, DateTime.UtcNow);
        Assert.IsFalse(service.ValidarDatosAlerta(alerta));
    }

    [Test]
    public void ValidarDatosAlerta_AlertaRealista_ReturnsTrue()
    {
        var service = new ValidadorDatosService();
        var alerta = new Alerta(
            "70B3D57ED0072E7F",
            12.3456,
            -76.5432,
            78,
            new DateTime(2025, 10, 6, 13, 49, 14, DateTimeKind.Local)
        );
        Assert.IsTrue(service.ValidarDatosAlerta(alerta));
    }
}